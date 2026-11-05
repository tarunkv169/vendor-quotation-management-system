package com.vqms.comparison.service.internal;

import com.vqms.comparison.client.dto.QuotationDetails;
import com.vqms.comparison.client.dto.ValidationSummary;
import com.vqms.comparison.config.ComparisonProperties;
import com.vqms.comparison.constants.ComparisonConstants;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Eligibility conditions evaluated BEFORE scoring. A quotation that fails any of them is
 * excluded from ranking, so it can never win on price alone:
 * latest validation PASSED for the current quotation version, comparable status, not expired,
 * and - when the request demands it - full coverage of the requested items.
 */
@Service
public class TechnicalComparisonService {

    private final ComparisonProperties properties;

    public TechnicalComparisonService(ComparisonProperties properties) {
        this.properties = properties;
    }

    public List<String> eligibilityProblems(QuotationDetails quotation, Optional<ValidationSummary> validation,
                                            BigDecimal coveragePercent, boolean requireAllItems, LocalDate today) {
        List<String> problems = new ArrayList<>();
        if (validation.isEmpty()) {
            problems.add("Quotation has not been validated");
        } else {
            if (validation.get().status() == null
                    || !properties.eligibleValidationStatuses().contains(validation.get().status())) {
                problems.add("Latest validation status is " + validation.get().status());
            }
            Long validatedVersion = validation.get().quotationVersion();
            if (validatedVersion != null && quotation.version() != null
                    && !Objects.equals(validatedVersion, quotation.version())) {
                problems.add("Quotation changed after its last validation");
            }
        }
        if (quotation.status() == null || !properties.comparableQuotationStatuses().contains(quotation.status())) {
            problems.add("Quotation status " + quotation.status() + " is not comparable");
        }
        if (quotation.validUntil() != null && quotation.validUntil().isBefore(today)) {
            problems.add("Quotation expired on " + quotation.validUntil());
        }
        if (requireAllItems && (coveragePercent == null
                || coveragePercent.compareTo(ComparisonConstants.HUNDRED) < 0)) {
            problems.add("Mandatory requirement not met: not all requested items are fully quoted");
        }
        return problems;
    }
}
