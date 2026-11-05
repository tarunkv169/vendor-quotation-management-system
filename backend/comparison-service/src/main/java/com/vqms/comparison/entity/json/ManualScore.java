package com.vqms.comparison.entity.json;

import com.vqms.comparison.enums.ComparisonCriteria;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Evaluator-entered score (0-100) for criteria without objective data (e.g. QUALITY).
 * Stored as JSON inside the comparison; the justification keeps the decision explainable.
 */
public record ManualScore(UUID quotationId, ComparisonCriteria criterion, BigDecimal score, String justification,
                          UUID enteredBy) {
}
