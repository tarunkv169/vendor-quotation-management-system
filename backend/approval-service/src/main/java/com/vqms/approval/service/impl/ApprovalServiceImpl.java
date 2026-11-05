package com.vqms.approval.service.impl;

import com.vqms.approval.client.ProcurementServiceClient;
import com.vqms.approval.client.RecommendationServiceClient;
import com.vqms.approval.client.dto.RecommendationInfo;
import com.vqms.approval.constants.ApprovalConstants;
import com.vqms.approval.dto.internal.ApprovalWorkflowResult;
import com.vqms.approval.dto.request.ApprovalDecisionRequest;
import com.vqms.approval.dto.request.ApprovalRequest;
import com.vqms.approval.dto.response.ApprovalHistoryResponse;
import com.vqms.approval.dto.response.ApprovalResponse;
import com.vqms.approval.dto.response.PageResponse;
import com.vqms.approval.entity.Approval;
import com.vqms.approval.entity.ApprovalPolicy;
import com.vqms.approval.entity.ApprovalStep;
import com.vqms.approval.enums.ApprovalStatus;
import com.vqms.approval.exception.ApprovalNotFoundException;
import com.vqms.approval.exception.ApprovalPolicyException;
import com.vqms.approval.exception.InvalidApprovalStateException;
import com.vqms.approval.mapper.ApprovalMapper;
import com.vqms.approval.policy.ApprovalPolicyEvaluator;
import com.vqms.approval.repository.ApprovalHistoryRepository;
import com.vqms.approval.repository.ApprovalRepository;
import com.vqms.approval.security.AuthenticatedUser;
import com.vqms.approval.security.CurrentUserProvider;
import com.vqms.approval.service.ApprovalService;
import com.vqms.approval.service.internal.ApprovalWorkflowService;
import com.vqms.approval.service.internal.ApproverAssignmentService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;

/**
 * Approval use cases. Authorization of decisions is never role-only: ApproverAssignmentService resolves
 * the concrete level and enforces self-approval and segregation-of-duties rules.
 */
@Service
public class ApprovalServiceImpl implements ApprovalService {

    private static final Logger log = LoggerFactory.getLogger(ApprovalServiceImpl.class);
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.DESC, "createdAt");
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final ApprovalRepository repository;
    private final ApprovalHistoryRepository historyRepository;
    private final RecommendationServiceClient recommendationClient;
    private final ProcurementServiceClient procurementClient;
    private final ApprovalPolicyEvaluator policyEvaluator;
    private final ApprovalWorkflowService workflowService;
    private final ApproverAssignmentService assignmentService;
    private final ApprovalMapper mapper;
    private final CurrentUserProvider currentUserProvider;
    private final TransactionTemplate transactionTemplate;

    public ApprovalServiceImpl(ApprovalRepository repository, ApprovalHistoryRepository historyRepository,
                               RecommendationServiceClient recommendationClient,
                               ProcurementServiceClient procurementClient, ApprovalPolicyEvaluator policyEvaluator,
                               ApprovalWorkflowService workflowService, ApproverAssignmentService assignmentService,
                               ApprovalMapper mapper,
                               CurrentUserProvider currentUserProvider, TransactionTemplate transactionTemplate) {
        this.repository = repository;
        this.historyRepository = historyRepository;
        this.recommendationClient = recommendationClient;
        this.procurementClient = procurementClient;
        this.policyEvaluator = policyEvaluator;
        this.workflowService = workflowService;
        this.assignmentService = assignmentService;
        this.mapper = mapper;
        this.currentUserProvider = currentUserProvider;
        this.transactionTemplate = transactionTemplate;
    }

    // ------------------------------------------------------------------ creation

    @Override
    public ApprovalResponse create(ApprovalRequest request) {
        AuthenticatedUser user = currentUserProvider.getCurrentUser();
        RecommendationInfo info = recommendationClient.getRecommendation(request.recommendationId());
        if (!"SUBMITTED_FOR_APPROVAL".equals(info.status())) {
            throw new InvalidApprovalStateException("Recommendation is not submitted for approval (status "
                    + info.status() + ")");
        }
        Approval approval = open(info, null, user.userId());
        return mapper.toResponse(approval, true);
    }

    private Approval open(RecommendationInfo info, UUID sourceEventId, UUID actorId) {
        if (info.recommendedQuotationId() == null || info.recommendedTotalAmount() == null
                || info.recommendedTotalAmount().signum() <= 0 || info.currencyCode() == null) {
            throw new InvalidApprovalStateException("Recommendation has no recommended quotation amount to approve");
        }
        UUID requesterId = procurementClient.findRequesterId(info.procurementRequestId()).orElse(null);
        Approval saved = transactionTemplate.execute(status -> {
            if (repository.existsByRecommendationIdAndStatusIn(info.id(),
                    EnumSet.of(ApprovalStatus.PENDING, ApprovalStatus.IN_PROGRESS, ApprovalStatus.APPROVED))) {
                throw new InvalidApprovalStateException("An approval already exists for recommendation " + info.id());
            }
            ApprovalPolicy policy = policyEvaluator.select(info.recommendedTotalAmount(), info.currencyCode());
            Approval approval = Approval.builder()
                    .approvalNumber(nextNumber())
                    .recommendationId(info.id())
                    .recommendationNumber(info.recommendationNumber())
                    .comparisonId(info.comparisonId())
                    .procurementRequestId(info.procurementRequestId())
                    .quotationId(info.recommendedQuotationId())
                    .vendorId(info.recommendedVendorId())
                    .amount(info.recommendedTotalAmount())
                    .currencyCode(info.currencyCode())
                    .submittedBy(info.submittedBy())
                    .requesterId(requesterId)
                    .riskLevel(info.riskLevel())
                    .requiresReview(info.requiresReview())
                    .reviewReasons(info.reviewReasons())
                    .sourceEventId(sourceEventId)
                    .policy(policy)
                    .build();
            Approval persisted = repository.saveAndFlush(approval);
            workflowService.start(persisted, actorId, Instant.now());
            return persisted;
        });
        if (saved != null) {
            log.info("Approval {} opened for recommendation {} ({} {}, policy {})", saved.getApprovalNumber(),
                    info.recommendationNumber(), saved.getAmount(), saved.getCurrencyCode(), saved.getPolicyCode());
        }
        return saved;
    }

    // ------------------------------------------------------------------ decisions

    @Override
    @Transactional
    public ApprovalResponse approve(UUID approvalId, ApprovalDecisionRequest request) {
        AuthenticatedUser user = currentUserProvider.getCurrentUser();
        Approval approval = load(approvalId);
        assertOpen(approval);
        Instant now = Instant.now();
        ApprovalWorkflowResult authority = assignmentService.resolve(approval, user, now);
        workflowService.approve(approval, authority, comment(request), now);
        log.info("Approval {} level {} approved by {} ({})", approval.getApprovalNumber(),
                authority.step().getLevelNumber(), user.userId(), authority.authority());
        return mapper.toResponse(approval, true);
    }

    @Override
    @Transactional
    public ApprovalResponse reject(UUID approvalId, ApprovalDecisionRequest request) {
        AuthenticatedUser user = currentUserProvider.getCurrentUser();
        Approval approval = load(approvalId);
        assertOpen(approval);
        Instant now = Instant.now();
        ApprovalWorkflowResult authority = assignmentService.resolve(approval, user, now);
        workflowService.reject(approval, authority, comment(request), now);
        log.info("Approval {} rejected at level {} by {}", approval.getApprovalNumber(),
                authority.step().getLevelNumber(), user.userId());
        return mapper.toResponse(approval, true);
    }

    @Override
    @Transactional
    public ApprovalResponse escalate(UUID approvalId, ApprovalDecisionRequest request) {
        AuthenticatedUser user = currentUserProvider.getCurrentUser();
        Approval approval = load(approvalId);
        assertOpen(approval);
        List<ApprovalStep> pending = approval.pendingSteps().stream().filter(s -> !s.isEscalated()).toList();
        if (pending.isEmpty()) {
            throw new InvalidApprovalStateException("No pending level can be escalated");
        }
        Instant now = Instant.now();
        pending.forEach(step -> workflowService.escalate(approval, step, user.userId(), comment(request), now));
        return mapper.toResponse(approval, true);
    }

    @Override
    @Transactional
    public ApprovalResponse cancel(UUID approvalId, ApprovalDecisionRequest request) {
        AuthenticatedUser user = currentUserProvider.getCurrentUser();
        String reason = comment(request);
        if (reason == null || reason.isBlank()) {
            throw new InvalidApprovalStateException("A reason is required to cancel an approval");
        }
        Approval approval = load(approvalId);
        workflowService.cancel(approval, user.userId(), reason, Instant.now());
        return mapper.toResponse(approval, true);
    }

    // ------------------------------------------------------------------ queries

    @Override
    @Transactional(readOnly = true)
    public ApprovalResponse getById(UUID approvalId) {
        return mapper.toResponse(load(approvalId), true);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ApprovalResponse> search(ApprovalStatus status, UUID procurementRequestId, Pageable pageable) {
        Pageable sorted = pageable.getSort().isSorted() ? pageable
                : PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), DEFAULT_SORT);
        return PageResponse.from(repository.findAll(ApprovalRepository.filter(status, procurementRequestId), sorted),
                a -> mapper.toResponse(a, false));
    }

    /** "My inbox": open approvals where the caller can decide a pending level right now. */
    @Override
    @Transactional(readOnly = true)
    public List<ApprovalResponse> pendingForCurrentUser() {
        AuthenticatedUser user = currentUserProvider.getCurrentUser();
        Instant now = Instant.now();
        return repository.findOpenWithPendingSteps(EnumSet.of(ApprovalStatus.PENDING, ApprovalStatus.IN_PROGRESS))
                .stream()
                .filter(a -> assignmentService.canAct(a, user, now))
                .map(a -> mapper.toResponse(a, true))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ApprovalHistoryResponse> history(UUID approvalId) {
        if (!repository.existsById(approvalId)) {
            throw new ApprovalNotFoundException("Approval not found: " + approvalId);
        }
        return historyRepository.findByApprovalIdOrderByCreatedAtAsc(approvalId).stream()
                .map(mapper::toHistoryResponse).toList();
    }

    // ------------------------------------------------------------------ helpers

    private Approval load(UUID id) {
        return repository.findWithStepsById(id).orElseThrow(() -> new ApprovalNotFoundException("Approval not found: " + id));
    }

    private static void assertOpen(Approval approval) {
        if (!approval.getStatus().isOpen()) {
            throw new InvalidApprovalStateException("Approval is already " + approval.getStatus());
        }
    }

    private static String comment(ApprovalDecisionRequest request) {
        return request == null ? null : request.comment();
    }

    private String nextNumber() {
        String date = LocalDate.now(ZoneOffset.UTC).format(DateTimeFormatter.BASIC_ISO_DATE);
        for (int attempt = 0; attempt < 5; attempt++) {
            StringBuilder suffix = new StringBuilder();
            for (int i = 0; i < 6; i++) {
                suffix.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
            }
            String number = "APR-" + date + "-" + suffix;
            if (!repository.existsByApprovalNumber(number)) {
                return number;
            }
        }
        throw new ApprovalPolicyException("Could not generate a unique approval number");
    }
}
