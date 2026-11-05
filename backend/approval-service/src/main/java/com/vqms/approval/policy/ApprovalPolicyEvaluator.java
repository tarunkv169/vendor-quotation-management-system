package com.vqms.approval.policy;

import com.vqms.approval.entity.ApprovalPolicy;

import java.math.BigDecimal;

/** Selects the approval policy that governs an amount in a currency. */
public interface ApprovalPolicyEvaluator {

    /** @throws com.vqms.approval.exception.ApprovalPolicyException when no single policy applies */
    ApprovalPolicy select(BigDecimal amount, String currencyCode);
}
