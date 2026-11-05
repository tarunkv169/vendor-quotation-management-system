package com.vqms.comparison.service.internal;

import com.vqms.comparison.calculator.ComparisonScoreCalculator;
import com.vqms.comparison.calculator.PriceComparisonCalculator;
import com.vqms.comparison.client.dto.ProcurementRequestDetails;
import com.vqms.comparison.client.dto.QuotationDetails;
import com.vqms.comparison.client.dto.ValidationSummary;
import com.vqms.comparison.config.ComparisonProperties;
import com.vqms.comparison.dto.internal.ComparisonCalculationResult;
import com.vqms.comparison.dto.internal.ComparisonCalculationResult.QuotationEvaluation;
import com.vqms.comparison.entity.json.LineComparison;
import com.vqms.comparison.entity.json.ManualScore;
import com.vqms.comparison.enums.ComparisonCriteria;
import com.vqms.comparison.enums.ComparisonResultType;
import com.vqms.comparison.exception.IncompatibleCurrencyException;
import com.vqms.comparison.exception.InsufficientQuotationsException;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

/**
 * Pure comparison algorithm (no I/O):
 * <ol>
 *   <li>eligibility (validation, status, expiry, mandatory item coverage, missing totals);</li>
 *   <li>currency compatibility - different currencies are never compared without an FX source;</li>
 *   <li>criterion scores; minimum-score thresholds remove quotations, then scores are recomputed
 *       for the remaining set (relative scores depend on who is compared);</li>
 *   <li>criteria without data for every eligible quotation are excluded and flagged for review;</li>
 *   <li>weighted overall score, ranking (score desc, total asc, id), lowest price, item-wise comparison.</li>
 * </ol>
 */
@Component
public class ComparisonEngine {

    private final ComparisonProperties properties;
    private final PriceComparisonCalculator priceCalculator;
    private final ComparisonScoreCalculator scoreCalculator;
    private final ItemComparisonService itemComparison;
    private final DeliveryComparisonService deliveryComparison;
    private final TechnicalComparisonService technicalComparison;

    public ComparisonEngine(ComparisonProperties properties, PriceComparisonCalculator priceCalculator,
                            ComparisonScoreCalculator scoreCalculator, ItemComparisonService itemComparison,
                            DeliveryComparisonService deliveryComparison,
                            TechnicalComparisonService technicalComparison) {
        this.properties = properties;
        this.priceCalculator = priceCalculator;
        this.scoreCalculator = scoreCalculator;
        this.itemComparison = itemComparison;
        this.deliveryComparison = deliveryComparison;
        this.technicalComparison = technicalComparison;
    }

    public record Candidate(QuotationDetails quotation, Optional<ValidationSummary> validation) {
    }

    /** Mutable working state for one quotation during the calculation. */
    private static final class Work {
        final QuotationDetails q;
        final Optional<ValidationSummary> validation;
        final List<String> reasons = new ArrayList<>();
        ComparisonResultType type = ComparisonResultType.RANKED;
        BigDecimal coverage;
        Integer delivery;
        Integer warranty;
        Map<ComparisonCriteria, BigDecimal> scores = new EnumMap<>(ComparisonCriteria.class);
        final List<ComparisonCriteria> missing = new ArrayList<>();
        BigDecimal overall;
        Integer rank;
        boolean lowest;
        BigDecimal difference;
        BigDecimal differencePercent;

        Work(Candidate candidate) {
            this.q = candidate.quotation();
            this.validation = candidate.validation();
        }

        boolean eligible() {
            return type == ComparisonResultType.RANKED;
        }

        void exclude(ComparisonResultType resultType, String reason) {
            this.type = resultType;
            this.reasons.add(reason);
        }
    }

    public ComparisonCalculationResult calculate(ProcurementRequestDetails request, List<Candidate> candidates,
                                                 Map<ComparisonCriteria, BigDecimal> weights,
                                                 Map<ComparisonCriteria, BigDecimal> minimumScores,
                                                 List<ManualScore> manualScores, boolean requireAllItems,
                                                 String requestedCurrency, LocalDate today) {
        List<Work> all = candidates.stream().map(Work::new).toList();

        // 1. Eligibility.
        for (Work w : all) {
            w.coverage = itemComparison.coveragePercent(request, w.q);
            w.delivery = deliveryComparison.maxDeliveryDays(w.q);
            w.warranty = deliveryComparison.minWarrantyMonths(w.q);
            List<String> problems = technicalComparison.eligibilityProblems(w.q, w.validation, w.coverage,
                    requireAllItems, today);
            if (!problems.isEmpty()) {
                w.type = ComparisonResultType.INELIGIBLE;
                w.reasons.addAll(problems);
            }
            if (w.q.totalAmount() == null || w.q.totalAmount().signum() <= 0) {
                w.exclude(ComparisonResultType.INCOMPARABLE, "Quotation has no positive total amount");
            }
        }

        // 2. Currency compatibility.
        String currency = resolveCurrency(all, requestedCurrency);
        for (Work w : all) {
            if (w.eligible() && !Objects.equals(w.q.currencyCode(), currency)) {
                w.exclude(ComparisonResultType.INCOMPARABLE,
                        "Currency " + w.q.currencyCode() + " differs from comparison currency " + currency);
            }
        }

        // 3-4. Scores with minimum thresholds (repeat until the eligible set is stable).
        Map<String, BigDecimal> manual = indexManualScores(manualScores);
        boolean changed = true;
        while (changed) {
            computeScores(all, manual);
            changed = applyMinimums(all, minimumScores);
        }

        List<Work> eligible = all.stream().filter(Work::eligible).toList();
        if (eligible.size() < properties.minimumEligibleQuotations()) {
            throw new InsufficientQuotationsException(eligible.size(), properties.minimumEligibleQuotations(),
                    summarizeReasons(all));
        }

        // 5. Exclude criteria lacking data, then overall score.
        Set<ComparisonCriteria> weighted = EnumSet.noneOf(ComparisonCriteria.class);
        weights.forEach((criterion, weight) -> {
            if (weight.signum() > 0) {
                weighted.add(criterion);
            }
        });
        Set<ComparisonCriteria> excluded = EnumSet.noneOf(ComparisonCriteria.class);
        for (ComparisonCriteria criterion : weighted) {
            for (Work w : eligible) {
                if (w.scores.get(criterion) == null) {
                    excluded.add(criterion);
                    w.missing.add(criterion);
                }
            }
        }
        Set<ComparisonCriteria> included = EnumSet.copyOf(weighted);
        included.removeAll(excluded);
        for (Work w : eligible) {
            w.overall = included.isEmpty() ? null : scoreCalculator.overall(w.scores, weights, included);
        }

        // 6. Ranking.
        List<Work> ranked = new ArrayList<>(eligible);
        ranked.sort(Comparator.comparing((Work w) -> w.overall, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(w -> w.q.totalAmount())
                .thenComparing(w -> w.q.id()));
        for (int i = 0; i < ranked.size(); i++) {
            ranked.get(i).rank = i + 1;
        }

        // 7. Lowest price among eligible quotations only.
        Map<UUID, BigDecimal> totals = new LinkedHashMap<>();
        eligible.forEach(w -> totals.put(w.q.id(), w.q.totalAmount()));
        Map.Entry<UUID, BigDecimal> lowest = priceCalculator.lowest(totals).orElseThrow();
        for (Work w : eligible) {
            w.lowest = w.q.id().equals(lowest.getKey());
            w.difference = w.q.totalAmount().subtract(lowest.getValue());
            w.differencePercent = priceCalculator.differencePercent(w.q.totalAmount(), lowest.getValue());
        }

        List<LineComparison> lines = itemComparison.compareLines(request,
                eligible.stream().map(w -> w.q).toList());

        List<QuotationEvaluation> evaluations = all.stream().map(ComparisonEngine::toEvaluation).toList();
        // Review is required when criteria had to be excluded, or an eligible quotation was validated with warnings.
        boolean validationWarnings = eligible.stream().anyMatch(w -> w.validation.map(ValidationSummary::needsReview).orElse(false));
        boolean requiresReview = !excluded.isEmpty() || included.isEmpty() || validationWarnings;
        return new ComparisonCalculationResult(currency, evaluations, lines, List.copyOf(excluded), eligible.size(),
                lowest.getKey(), requiresReview);
    }

    private static String resolveCurrency(List<Work> all, String requestedCurrency) {
        if (requestedCurrency != null) {
            return requestedCurrency;
        }
        Set<String> currencies = new TreeSet<>();
        all.stream().filter(Work::eligible).map(w -> w.q.currencyCode()).filter(Objects::nonNull)
                .forEach(currencies::add);
        if (currencies.size() > 1) {
            throw new IncompatibleCurrencyException(currencies);
        }
        return currencies.isEmpty() ? null : currencies.iterator().next();
    }

    private void computeScores(List<Work> all, Map<String, BigDecimal> manual) {
        List<Work> eligible = all.stream().filter(Work::eligible).toList();
        Map<UUID, BigDecimal> totals = new LinkedHashMap<>();
        Map<UUID, Integer> delivery = new LinkedHashMap<>();
        Map<UUID, Integer> warranty = new LinkedHashMap<>();
        eligible.forEach(w -> {
            totals.put(w.q.id(), w.q.totalAmount());
            delivery.put(w.q.id(), w.delivery);
            warranty.put(w.q.id(), w.warranty);
        });
        Map<UUID, BigDecimal> price = priceCalculator.priceScores(totals);
        Map<UUID, BigDecimal> deliveryScores = scoreCalculator.lowerIsBetter(delivery);
        Map<UUID, BigDecimal> warrantyScores = scoreCalculator.higherIsBetter(warranty);

        for (Work w : all) {
            w.scores = new EnumMap<>(ComparisonCriteria.class);
            if (!w.eligible()) {
                continue;
            }
            UUID id = w.q.id();
            put(w.scores, ComparisonCriteria.PRICE, price.get(id));
            put(w.scores, ComparisonCriteria.DELIVERY_TIME, deliveryScores.get(id));
            put(w.scores, ComparisonCriteria.WARRANTY, warrantyScores.get(id));
            BigDecimal technicalManual = manual.get(key(id, ComparisonCriteria.TECHNICAL_COMPLIANCE));
            put(w.scores, ComparisonCriteria.TECHNICAL_COMPLIANCE, technicalManual != null ? technicalManual : w.coverage);
            put(w.scores, ComparisonCriteria.QUALITY, manual.get(key(id, ComparisonCriteria.QUALITY)));
            put(w.scores, ComparisonCriteria.COMMERCIAL_TERMS, manual.get(key(id, ComparisonCriteria.COMMERCIAL_TERMS)));
        }
    }

    /** Returns true when at least one quotation became ineligible. */
    private static boolean applyMinimums(List<Work> all, Map<ComparisonCriteria, BigDecimal> minimumScores) {
        if (minimumScores == null || minimumScores.isEmpty()) {
            return false;
        }
        boolean changed = false;
        for (Work w : all) {
            if (!w.eligible()) {
                continue;
            }
            for (Map.Entry<ComparisonCriteria, BigDecimal> min : minimumScores.entrySet()) {
                BigDecimal score = w.scores.get(min.getKey());
                if (score == null) {
                    w.exclude(ComparisonResultType.INELIGIBLE,
                            "No data for mandatory criterion " + min.getKey() + " (information missing)");
                    changed = true;
                    break;
                }
                if (score.compareTo(min.getValue()) < 0) {
                    w.exclude(ComparisonResultType.INELIGIBLE, min.getKey() + " score " + score.toPlainString()
                            + " is below the required minimum " + min.getValue().toPlainString());
                    changed = true;
                    break;
                }
            }
        }
        return changed;
    }

    private static Map<String, BigDecimal> indexManualScores(List<ManualScore> manualScores) {
        Map<String, BigDecimal> index = new HashMap<>();
        if (manualScores != null) {
            manualScores.forEach(s -> index.put(key(s.quotationId(), s.criterion()), s.score()));
        }
        return index;
    }

    private static String key(UUID quotationId, ComparisonCriteria criterion) {
        return quotationId + ":" + criterion;
    }

    private static void put(Map<ComparisonCriteria, BigDecimal> scores, ComparisonCriteria c, BigDecimal value) {
        if (value != null) {
            scores.put(c, value);
        }
    }

    private static String summarizeReasons(List<Work> all) {
        return all.stream().filter(w -> !w.eligible())
                .map(w -> (w.q.quotationNumber() != null ? w.q.quotationNumber() : w.q.id()) + ": "
                        + String.join("; ", w.reasons))
                .reduce((a, b) -> a + " | " + b).orElse("no candidate quotations");
    }

    private static QuotationEvaluation toEvaluation(Work w) {
        return new QuotationEvaluation(w.q.id(), w.q.vendorId(), w.q.quotationNumber(),
                w.validation.map(ValidationSummary::id).orElse(null), w.type, List.copyOf(w.reasons),
                w.q.currencyCode(), w.q.subtotal(), w.q.discountAmount(), w.q.taxAmount(), w.q.totalAmount(),
                w.delivery, w.warranty, w.coverage, Map.copyOf(w.scores), List.copyOf(w.missing), w.overall, w.rank,
                w.lowest, w.difference, w.differencePercent);
    }
}
