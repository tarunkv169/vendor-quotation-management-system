package com.vqms.approval.entity.json;

import com.vqms.approval.enums.ApprovalLevel;

import java.math.BigDecimal;

/**
 * One level of an approval policy (stored as JSON in the policy).
 *
 * @param requiredRole  Identity role allowed to decide this level
 * @param approvalLimit maximum amount this level is authorised to approve
 * @param deadlineHours time allowed for a decision before escalation
 */
public record PolicyLevel(int levelNumber, ApprovalLevel level, String requiredRole, BigDecimal approvalLimit,
                          int deadlineHours) {
}
