package com.vqms.recommendation.service.internal;

import com.vqms.recommendation.config.RecommendationProperties;
import com.vqms.recommendation.client.dto.ComparisonResults.VendorResult;
import com.vqms.recommendation.client.dto.ValidationSummary;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Mandatory eligibility, evaluated before any scoring. A quotation is eligible only if the
 * comparison ranked it (it met every mandatory requirement there) AND its latest validation
 * still has an accepted status now (PASSED, or NEEDS_REVIEW when configured) - a later failed validation removes it
 * even after the comparison was completed.
 */
@Service
public class EligibilityService {

    private final RecommendationProperties properties;

    public EligibilityService(RecommendationProperties properties) {
        this.properties = properties;
    }

    public List<String> problems(VendorResult result, Optional<ValidationSummary> latestValidation) {
        List<String> problems = new ArrayList<>();
        if (!result.ranked()) {
            problems.add("Excluded by comparison (" + result.resultType() + ")"
                    + (result.eligibilityReasons() == null || result.eligibilityReasons().isEmpty() ? ""
                    : ": " + String.join("; ", result.eligibilityReasons())));
        }
        if (latestValidation.isEmpty()) {
            problems.add("No validation result found");
        } else if (latestValidation.get().status() == null
                || !properties.eligibleValidationStatuses().contains(latestValidation.get().status())) {
            problems.add("Latest validation status is " + latestValidation.get().status());
        }
        return problems;
    }
}
