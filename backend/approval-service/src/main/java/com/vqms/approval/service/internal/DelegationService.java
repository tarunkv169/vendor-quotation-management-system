package com.vqms.approval.service.internal;

import com.vqms.approval.client.IdentityServiceClient;
import com.vqms.approval.config.ApprovalProperties;
import com.vqms.approval.dto.request.ApprovalDelegationRequest;
import com.vqms.approval.entity.ApprovalDelegation;
import com.vqms.approval.exception.ApprovalNotFoundException;
import com.vqms.approval.exception.InvalidApprovalStateException;
import com.vqms.approval.exception.UnauthorizedApproverException;
import com.vqms.approval.repository.ApprovalDelegationRepository;
import com.vqms.approval.security.AuthenticatedUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Delegation rules: no self-delegation, delegate must be an active user, no overlapping delegations
 * by the same delegator, no re-delegation of authority received from someone else, bounded duration.
 */
@Service
public class DelegationService {

    private final ApprovalDelegationRepository repository;
    private final IdentityServiceClient identityClient;
    private final ApprovalProperties properties;

    public DelegationService(ApprovalDelegationRepository repository, IdentityServiceClient identityClient,
                             ApprovalProperties properties) {
        this.repository = repository;
        this.identityClient = identityClient;
        this.properties = properties;
    }

    @Transactional
    public ApprovalDelegation create(AuthenticatedUser delegator, ApprovalDelegationRequest request) {
        Instant now = Instant.now();
        Instant from = request.validFrom() == null ? now : request.validFrom();
        if (!request.validUntil().isAfter(from)) {
            throw new InvalidApprovalStateException("validUntil must be after validFrom");
        }
        if (Duration.between(from, request.validUntil()).toDays() > properties.maxDelegationDays()) {
            throw new InvalidApprovalStateException("Delegations may last at most " + properties.maxDelegationDays()
                    + " days");
        }
        if (delegator.userId().equals(request.delegateId())) {
            throw new InvalidApprovalStateException("You cannot delegate to yourself");
        }
        boolean overlapping = repository.findByDelegatorIdAndActiveTrue(delegator.userId()).stream()
                .anyMatch(d -> from.isBefore(d.getValidUntil()) && request.validUntil().isAfter(d.getValidFrom()));
        if (overlapping) {
            throw new InvalidApprovalStateException("You already have an active delegation in this period");
        }
        IdentityServiceClient.UserInfo delegate = identityClient.findUser(request.delegateId())
                .orElseThrow(() -> new InvalidApprovalStateException("Delegate user does not exist"));
        if (!delegate.isActive() || "VENDOR".equalsIgnoreCase(delegate.role())) {
            throw new InvalidApprovalStateException("Delegate must be an active internal user");
        }
        return repository.save(new ApprovalDelegation(delegator.userId(), delegator.role(), request.delegateId(), from,
                request.validUntil(), request.reason()));
    }

    @Transactional
    public ApprovalDelegation revoke(AuthenticatedUser user, UUID delegationId) {
        ApprovalDelegation delegation = repository.findById(delegationId)
                .orElseThrow(() -> new ApprovalNotFoundException("Delegation not found: " + delegationId));
        if (!delegation.getDelegatorId().equals(user.userId()) && !user.isAdministrator()) {
            throw new UnauthorizedApproverException("Only the delegator or an administrator can revoke a delegation");
        }
        delegation.revoke(Instant.now());
        return delegation;
    }

    @Transactional(readOnly = true)
    public List<ApprovalDelegation> mine(UUID userId) {
        return repository.findByDelegatorIdOrDelegateIdOrderByCreatedAtDesc(userId, userId);
    }

    /** Delegations currently giving {@code delegateId} someone else's authority. */
    @Transactional(readOnly = true)
    public List<ApprovalDelegation> effectiveFor(UUID delegateId, Instant now) {
        return repository.findByDelegateIdAndActiveTrue(delegateId).stream().filter(d -> d.isEffective(now)).toList();
    }
}
