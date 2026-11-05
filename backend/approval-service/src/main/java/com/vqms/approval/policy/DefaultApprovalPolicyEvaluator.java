package com.vqms.approval.policy;

import com.vqms.approval.entity.ApprovalPolicy;
import com.vqms.approval.exception.ApprovalPolicyException;
import com.vqms.approval.repository.ApprovalPolicyRepository;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;

/**
 * Picks the active policy whose amount band (inclusive) contains the amount, in the same currency.
 * Highest priority wins; equal top priorities are ambiguous and rejected (no silent guess).
 */
@Component
public class DefaultApprovalPolicyEvaluator implements ApprovalPolicyEvaluator {

    private final ApprovalPolicyRepository repository;

    public DefaultApprovalPolicyEvaluator(ApprovalPolicyRepository repository) {
        this.repository = repository;
    }

    @Override
    public ApprovalPolicy select(BigDecimal amount, String currencyCode) {
        List<ApprovalPolicy> matching = repository.findByActiveTrueAndCurrencyCode(currencyCode).stream()
                .filter(p -> p.covers(amount, currencyCode))
                .sorted(Comparator.comparingInt(ApprovalPolicy::getPriority).reversed())
                .toList();
        if (matching.isEmpty()) {
            throw new ApprovalPolicyException("No active approval policy covers " + amount.toPlainString() + " "
                    + currencyCode);
        }
        if (matching.size() > 1 && matching.get(0).getPriority() == matching.get(1).getPriority()) {
            throw new ApprovalPolicyException("Approval policies " + matching.get(0).getCode() + " and "
                    + matching.get(1).getCode() + " overlap with the same priority");
        }
        return matching.get(0);
    }
}
