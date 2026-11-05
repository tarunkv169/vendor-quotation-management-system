package com.vqms.recommendation.enums;

/** Ordered from lowest to highest; CRITICAL quotations are never recommended. */
public enum RiskLevel {
    LOW,
    MEDIUM,
    HIGH,
    CRITICAL;

    public RiskLevel max(RiskLevel other) {
        return other != null && other.ordinal() > ordinal() ? other : this;
    }
}
