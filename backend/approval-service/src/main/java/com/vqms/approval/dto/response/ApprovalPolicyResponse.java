package com.vqms.approval.dto.response;

import com.vqms.approval.entity.json.PolicyLevel;
import com.vqms.approval.enums.ApprovalMode;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record ApprovalPolicyResponse(UUID id, String code, String name, String description, String currencyCode,
                                     BigDecimal minAmount, BigDecimal maxAmount, ApprovalMode mode,
                                     List<PolicyLevel> levels, String escalationRole, int escalationHours,
                                     int priority, boolean active, Long version) {
}
