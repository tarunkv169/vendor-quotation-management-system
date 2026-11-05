package com.vqms.approval.service;

import com.vqms.approval.dto.request.ApprovalPolicyRequest;
import com.vqms.approval.dto.response.ApprovalPolicyResponse;
import com.vqms.approval.entity.ApprovalPolicy;
import com.vqms.approval.entity.json.PolicyLevel;
import com.vqms.approval.exception.ApprovalNotFoundException;
import com.vqms.approval.exception.ApprovalPolicyException;
import com.vqms.approval.mapper.ApprovalMapper;
import com.vqms.approval.repository.ApprovalPolicyRepository;
import com.vqms.approval.security.CurrentUserProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Policy administration. Rules: levels strictly ascending, approval limits non-decreasing, and the
 * highest level must be authorised for the policy's maximum amount. Policies are deactivated, never
 * deleted, so historic approvals keep their reference.
 */
@Service
public class ApprovalPolicyService {

    private final ApprovalPolicyRepository repository;
    private final ApprovalMapper mapper;
    private final CurrentUserProvider currentUserProvider;

    public ApprovalPolicyService(ApprovalPolicyRepository repository, ApprovalMapper mapper,
                                 CurrentUserProvider currentUserProvider) {
        this.repository = repository;
        this.mapper = mapper;
        this.currentUserProvider = currentUserProvider;
    }

    @Transactional
    public ApprovalPolicyResponse create(ApprovalPolicyRequest request) {
        if (repository.existsByCode(request.code())) {
            throw new ApprovalPolicyException("Policy code " + request.code() + " already exists");
        }
        ApprovalPolicy policy = new ApprovalPolicy(request.code(), currentUserProvider.getCurrentUser().userId());
        apply(policy, request);
        return mapper.toPolicyResponse(repository.save(policy));
    }

    @Transactional
    public ApprovalPolicyResponse update(UUID id, ApprovalPolicyRequest request) {
        ApprovalPolicy policy = find(id);
        if (!policy.getCode().equals(request.code())) {
            throw new ApprovalPolicyException("Policy code cannot be changed");
        }
        apply(policy, request);
        return mapper.toPolicyResponse(policy);
    }

    @Transactional
    public ApprovalPolicyResponse deactivate(UUID id) {
        ApprovalPolicy policy = find(id);
        policy.deactivate();
        return mapper.toPolicyResponse(policy);
    }

    @Transactional(readOnly = true)
    public ApprovalPolicyResponse get(UUID id) {
        return mapper.toPolicyResponse(find(id));
    }

    @Transactional(readOnly = true)
    public List<ApprovalPolicyResponse> list() {
        return repository.findAll().stream().map(mapper::toPolicyResponse).toList();
    }

    private ApprovalPolicy find(UUID id) {
        return repository.findById(id).orElseThrow(() -> new ApprovalNotFoundException("Approval policy not found: " + id));
    }

    private static void apply(ApprovalPolicy policy, ApprovalPolicyRequest r) {
        if (r.maxAmount() != null && r.maxAmount().compareTo(r.minAmount()) < 0) {
            throw new ApprovalPolicyException("maxAmount must not be below minAmount");
        }
        List<PolicyLevel> levels = new ArrayList<>();
        BigDecimal previousLimit = BigDecimal.ZERO;
        for (int i = 0; i < r.levels().size(); i++) {
            ApprovalPolicyRequest.Level level = r.levels().get(i);
            if (level.level().ordinal() != i) {
                throw new ApprovalPolicyException("Levels must be listed in order LEVEL_1, LEVEL_2, ...");
            }
            if (level.approvalLimit().compareTo(previousLimit) < 0) {
                throw new ApprovalPolicyException("Approval limits must not decrease with higher levels");
            }
            previousLimit = level.approvalLimit();
            levels.add(new PolicyLevel(i + 1, level.level(), level.requiredRole().toUpperCase(), level.approvalLimit(),
                    level.deadlineHours()));
        }
        if (r.maxAmount() != null && previousLimit.compareTo(r.maxAmount()) < 0) {
            throw new ApprovalPolicyException("The highest level must be authorised for the policy's maxAmount");
        }
        policy.update(r.name(), r.description(), r.currencyCode(), r.minAmount(), r.maxAmount(), r.mode(), levels,
                r.escalationRole().toUpperCase(), r.escalationHours(), r.priority());
    }
}
