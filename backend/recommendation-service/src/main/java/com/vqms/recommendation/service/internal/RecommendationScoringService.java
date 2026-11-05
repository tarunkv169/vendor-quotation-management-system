package com.vqms.recommendation.service.internal;

import com.vqms.recommendation.calculator.RecommendationScoreCalculator;
import com.vqms.recommendation.client.dto.ComparisonResults;
import com.vqms.recommendation.client.dto.ComparisonResults.VendorResult;
import com.vqms.recommendation.client.dto.ProcurementRequestInfo;
import com.vqms.recommendation.client.dto.ValidationSummary;
import com.vqms.recommendation.dto.internal.RecommendationCalculationResult;
import com.vqms.recommendation.dto.internal.RecommendationCalculationResult.Evaluation;
import com.vqms.recommendation.dto.internal.RecommendationCalculationResult.RiskFactor;
import com.vqms.recommendation.enums.RecommendationCriteria;
import com.vqms.recommendation.enums.RecommendationRole;
import com.vqms.recommendation.enums.RecommendationType;
import com.vqms.recommendation.enums.RiskLevel;
import com.vqms.recommendation.policy.RecommendationPolicy;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Applies a policy to completed comparison results:
 * eligibility -> criteria without data excluded (flagged) -> weighted policy score -> risk ->
 * PRIMARY / ALTERNATIVE / NOT_RECOMMENDED -> explanations.
 * The lowest price alone never decides: the primary is the highest policy score among eligible,
 * acceptable-risk quotations that reach the minimum score.
 */
@Service
public class RecommendationScoringService {

    private final EligibilityService eligibilityService;
    private final RiskAssessmentService riskAssessmentService;
    private final RecommendationScoreCalculator scoreCalculator;

    public RecommendationScoringService(EligibilityService eligibilityService,
                                        RiskAssessmentService riskAssessmentService,
                                        RecommendationScoreCalculator scoreCalculator) {
        this.eligibilityService = eligibilityService;
        this.riskAssessmentService = riskAssessmentService;
        this.scoreCalculator = scoreCalculator;
    }

    private static final class Work {
        final VendorResult r;
        final List<String> problems;
        final List<RecommendationCriteria> missing = new ArrayList<>();
        List<RiskFactor> risks = List.of();
        RiskLevel risk = RiskLevel.LOW;
        BigDecimal score;
        Integer rank;
        RecommendationRole role = RecommendationRole.NOT_RECOMMENDED;
        String reason;

        Work(VendorResult r, List<String> problems) {
            this.r = r;
            this.problems = problems;
        }

        boolean eligible() {
            return problems.isEmpty();
        }
    }

    public RecommendationCalculationResult recommend(ComparisonResults comparison, ProcurementRequestInfo request,
                                                     Map<UUID, Optional<ValidationSummary>> validations,
                                                     RecommendationPolicy policy,
                                                     Map<RecommendationCriteria, BigDecimal> requestedWeights) {
        Map<RecommendationCriteria, BigDecimal> weights =
                policy.resolveWeights(requestedWeights, comparison.comparison().criteriaWeights());

        List<Work> all = comparison.safeResults().stream()
                .map(r -> new Work(r, eligibilityService.problems(r,
                        validations.getOrDefault(r.quotationId(), Optional.empty()))))
                .toList();
        List<Work> eligible = all.stream().filter(Work::eligible).toList();
        List<VendorResult> eligibleResults = eligible.stream().map(w -> w.r).toList();

        // Criteria without data for some eligible quotation are excluded for everyone (comparability).
        Set<RecommendationCriteria> weighted = weights.entrySet().stream().filter(e -> e.getValue().signum() > 0)
                .map(Map.Entry::getKey).collect(Collectors.toCollection(() -> EnumSet.noneOf(RecommendationCriteria.class)));
        Set<RecommendationCriteria> excluded = EnumSet.noneOf(RecommendationCriteria.class);
        for (Work w : eligible) {
            for (RecommendationCriteria c : weighted) {
                if (w.r.criterionScores() == null || w.r.criterionScores().get(c) == null) {
                    excluded.add(c);
                    w.missing.add(c);
                }
            }
        }
        Set<RecommendationCriteria> included = EnumSet.noneOf(RecommendationCriteria.class);
        included.addAll(weighted);
        included.removeAll(excluded);

        for (Work w : eligible) {
            w.score = included.isEmpty() ? null : scoreCalculator.overall(w.r.criterionScores(), weights, included);
            w.risks = riskAssessmentService.assess(w.r, eligibleResults, request);
            w.risk = RiskAssessmentService.level(w.risks);
        }

        // Ranking by policy score (desc), then lower total, then id.
        List<Work> ranked = new ArrayList<>(eligible);
        ranked.sort(Comparator.comparing((Work w) -> w.score, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(w -> w.r.totalAmount(), Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(w -> w.r.quotationId()));
        for (int i = 0; i < ranked.size(); i++) {
            ranked.get(i).rank = i + 1;
        }

        // Roles.
        int alternatives = 0;
        Work primary = null;
        for (Work w : ranked) {
            if (w.score == null) {
                w.reason = "No policy score could be calculated (missing criterion data)";
            } else if (w.score.compareTo(policy.minimumOverallScore()) < 0) {
                w.reason = "Score " + w.score.toPlainString() + " is below the policy minimum "
                        + policy.minimumOverallScore().toPlainString();
            } else if (!policy.isAcceptableRisk(w.risk)) {
                w.reason = "Risk level " + w.risk + " is not acceptable under policy " + policy.code();
            } else if (primary == null) {
                primary = w;
                w.role = RecommendationRole.PRIMARY;
            } else if (alternatives < policy.maxAlternatives()) {
                w.role = RecommendationRole.ALTERNATIVE;
                alternatives++;
            } else {
                w.reason = "Ranked below the configured number of alternatives";
            }
        }
        for (Work w : all) {
            if (!w.eligible()) {
                w.reason = "Not eligible: " + String.join("; ", w.problems);
            }
        }

        RecommendationType type = primary == null ? RecommendationType.NO_QUALIFYING_VENDOR
                : eligible.size() == 1 ? RecommendationType.SINGLE_ELIGIBLE_VENDOR : RecommendationType.BEST_VALUE;

        List<String> reviewReasons = new ArrayList<>();
        if (primary == null) {
            reviewReasons.add("No quotation meets the policy; a manual decision is required");
        }
        if (type == RecommendationType.SINGLE_ELIGIBLE_VENDOR) {
            reviewReasons.add("Only one eligible quotation (no competition)");
        }
        if (!excluded.isEmpty()) {
            reviewReasons.add("Criteria excluded for missing data: " + excluded);
        }
        if (primary != null && policy.requiresReview(primary.risk)) {
            reviewReasons.add("Recommended quotation has " + primary.risk + " risk");
        }
        if (comparison.comparison().requiresReview()) {
            reviewReasons.add("The comparison itself was flagged for review");
        }

        List<Evaluation> evaluations = all.stream().map(w -> new Evaluation(w.r.quotationId(), w.r.vendorId(),
                        w.r.label(), w.eligible(), List.copyOf(w.problems), w.role, w.r.totalAmount(),
                        w.r.criterionScores() == null ? Map.of() : Map.copyOf(w.r.criterionScores()),
                        List.copyOf(w.missing), w.score, w.rank, w.risk, List.copyOf(w.risks),
                        explainItem(w, weights, included)))
                .sorted(Comparator.comparing(Evaluation::rank, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();

        String explanation = explainOverall(type, primary, ranked, weights, excluded, reviewReasons, policy);
        return new RecommendationCalculationResult(type, weights, List.copyOf(excluded),
                primary == null ? null : primary.r.quotationId(), primary == null ? null : primary.r.vendorId(),
                primary == null ? null : primary.score, primary == null ? null : primary.risk,
                !reviewReasons.isEmpty(), reviewReasons, explanation, evaluations);
    }

    // ------------------------------------------------------------------ explanations

    private static String explainItem(Work w, Map<RecommendationCriteria, BigDecimal> weights,
                                      Set<RecommendationCriteria> included) {
        StringBuilder sb = new StringBuilder();
        sb.append(w.r.label()).append(": ").append(w.role);
        if (w.rank != null) {
            sb.append(" (rank ").append(w.rank).append(")");
        }
        if (w.score != null) {
            sb.append(". Policy score ").append(w.score.toPlainString()).append(" = ");
            sb.append(included.stream()
                    .filter(c -> weights.getOrDefault(c, BigDecimal.ZERO).signum() > 0)
                    .map(c -> c + " " + w.r.criterionScores().get(c).stripTrailingZeros().toPlainString() + " x "
                            + weights.get(c).stripTrailingZeros().toPlainString() + "%")
                    .collect(Collectors.joining(" + ")));
        }
        if (w.r.lowestPrice()) {
            sb.append(". Lowest eligible price");
        }
        if (w.eligible()) {
            sb.append(". Risk ").append(w.risk);
            if (!w.risks.isEmpty()) {
                sb.append(" (").append(w.risks.stream().map(RiskFactor::description)
                        .collect(Collectors.joining("; "))).append(")");
            }
        }
        if (w.reason != null) {
            sb.append(". ").append(w.reason);
        }
        return sb.append('.').toString();
    }

    private static String explainOverall(RecommendationType type, Work primary, List<Work> ranked,
                                         Map<RecommendationCriteria, BigDecimal> weights,
                                         Set<RecommendationCriteria> excluded, List<String> reviewReasons,
                                         RecommendationPolicy policy) {
        StringBuilder sb = new StringBuilder();
        sb.append("Policy ").append(policy.code()).append(" with weights ").append(weights).append(". ");
        if (primary == null) {
            sb.append("No vendor is recommended: none of the ").append(ranked.size())
                    .append(" eligible quotation(s) meets the policy.");
        } else {
            sb.append(primary.r.label()).append(" is recommended (").append(type).append(") with policy score ")
                    .append(primary.score.toPlainString()).append(" of 100 and ").append(primary.risk).append(" risk");
            sb.append(primary.r.lowestPrice() ? "; it is also the lowest eligible price."
                    : "; it is not the lowest price, but scores highest across the weighted criteria.");
        }
        if (!excluded.isEmpty()) {
            sb.append(" Criteria ").append(excluded).append(" were excluded because data was missing.");
        }
        if (!reviewReasons.isEmpty()) {
            sb.append(" Review required: ").append(String.join("; ", reviewReasons)).append('.');
        }
        sb.append(" This is a recommendation only; approval is decided in the Approval workflow.");
        return sb.toString();
    }
}
