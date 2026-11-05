package com.vqms.recommendation.service.impl;

import com.vqms.recommendation.client.ComparisonServiceClient;
import com.vqms.recommendation.client.ProcurementServiceClient;
import com.vqms.recommendation.client.ValidationServiceClient;
import com.vqms.recommendation.client.dto.ComparisonResults;
import com.vqms.recommendation.client.dto.ProcurementRequestInfo;
import com.vqms.recommendation.client.dto.ValidationSummary;
import com.vqms.recommendation.constants.RecommendationConstants;
import com.vqms.recommendation.dto.internal.RecommendationCalculationResult;
import com.vqms.recommendation.dto.request.RecommendationRequest;
import com.vqms.recommendation.dto.request.SubmitForApprovalRequest;
import com.vqms.recommendation.dto.response.PageResponse;
import com.vqms.recommendation.dto.response.RecommendationExplanationResponse;
import com.vqms.recommendation.dto.response.RecommendationResponse;
import com.vqms.recommendation.dto.response.RecommendedVendorResponse;
import com.vqms.recommendation.entity.Recommendation;
import com.vqms.recommendation.enums.RecommendationCriteria;
import com.vqms.recommendation.enums.RecommendationStatus;
import com.vqms.recommendation.event.RecommendationEventPublisher;
import com.vqms.recommendation.exception.InvalidRecommendationException;
import com.vqms.recommendation.exception.NoEligibleVendorException;
import com.vqms.recommendation.exception.RecommendationNotFoundException;
import com.vqms.recommendation.mapper.RecommendationMapper;
import com.vqms.recommendation.policy.DefaultRecommendationPolicy;
import com.vqms.recommendation.policy.RecommendationPolicy;
import com.vqms.recommendation.repository.RecommendationRepository;
import com.vqms.recommendation.security.CurrentUserProvider;
import com.vqms.recommendation.service.RecommendationService;
import com.vqms.recommendation.service.internal.RecommendationScoringService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Recommendation workflow: load comparison results, procurement requirements and current validation
 * status (no DB transaction during these calls), apply the policy, then persist the recommendation and
 * its outbox event in one transaction.
 */
@Service
public class RecommendationServiceImpl implements RecommendationService {

    private static final Logger log = LoggerFactory.getLogger(RecommendationServiceImpl.class);
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.DESC, "createdAt");
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final RecommendationRepository repository;
    private final ComparisonServiceClient comparisonClient;
    private final ProcurementServiceClient procurementClient;
    private final ValidationServiceClient validationClient;
    private final RecommendationScoringService scoringService;
    private final RecommendationEventPublisher eventPublisher;
    private final RecommendationMapper mapper;
    private final CurrentUserProvider currentUserProvider;
    private final TransactionTemplate transactionTemplate;
    private final Map<String, RecommendationPolicy> policies;

    public RecommendationServiceImpl(RecommendationRepository repository,
                                     ComparisonServiceClient comparisonClient,
                                     ProcurementServiceClient procurementClient,
                                     ValidationServiceClient validationClient,
                                     RecommendationScoringService scoringService,
                                     RecommendationEventPublisher eventPublisher,
                                     RecommendationMapper mapper, CurrentUserProvider currentUserProvider,
                                     TransactionTemplate transactionTemplate, List<RecommendationPolicy> policies) {
        this.repository = repository;
        this.comparisonClient = comparisonClient;
        this.procurementClient = procurementClient;
        this.validationClient = validationClient;
        this.scoringService = scoringService;
        this.eventPublisher = eventPublisher;
        this.mapper = mapper;
        this.currentUserProvider = currentUserProvider;
        this.transactionTemplate = transactionTemplate;
        this.policies = policies.stream().collect(Collectors.toMap(RecommendationPolicy::code, Function.identity()));
    }

    // ------------------------------------------------------------------ commands

    @Override
    public RecommendationResponse generate(RecommendationRequest request) {
        UUID userId = currentUserProvider.getCurrentUser().userId();
        Map<RecommendationCriteria, BigDecimal> weights = new EnumMap<>(RecommendationCriteria.class);
        if (request.criteria() != null) {
            for (RecommendationRequest.CriterionWeight w : request.criteria()) {
                if (weights.put(w.criterion(), w.weight()) != null) {
                    throw new InvalidRecommendationException("Criterion " + w.criterion() + " is listed more than once");
                }
            }
        }
        Prepared prepared = prepare(request.comparisonId(), request.policyCode(), weights);
        Recommendation saved = persist(() -> {
            Recommendation r = newRecommendation(prepared, null, null, userId);
            Recommendation stored = repository.save(r);
            eventPublisher.publishGenerated(stored);
            return stored;
        });
        return mapper.toResponse(saved);
    }

    @Override
    public RecommendationResponse regenerate(UUID recommendationId) {
        UUID userId = currentUserProvider.getCurrentUser().userId();
        Recommendation previous = repository.findById(recommendationId)
                .orElseThrow(() -> new RecommendationNotFoundException(recommendationId));
        if (previous.getStatus() == RecommendationStatus.SUBMITTED_FOR_APPROVAL
                || previous.getStatus() == RecommendationStatus.SUPERSEDED) {
            throw new InvalidRecommendationException("Recommendation in status " + previous.getStatus()
                    + " cannot be regenerated");
        }
        Prepared prepared = prepare(previous.getComparisonId(), previous.getPolicyCode(), previous.getCriteriaWeights());
        Recommendation saved = persist(() -> {
            Recommendation old = repository.findById(recommendationId)
                    .orElseThrow(() -> new RecommendationNotFoundException(recommendationId));
            old.supersede();
            Recommendation stored = repository.save(newRecommendation(prepared, old.getId(), null, userId));
            eventPublisher.publishRegenerated(stored);
            return stored;
        });
        return mapper.toResponse(saved);
    }

    @Override
    @Transactional
    public RecommendationResponse submitForApproval(UUID recommendationId, SubmitForApprovalRequest request) {
        UUID userId = currentUserProvider.getCurrentUser().userId();
        Recommendation recommendation = load(recommendationId);
        recommendation.submitForApproval(userId, request == null ? null : request.comment(),
                request != null && request.reviewAcknowledged());
        eventPublisher.publishSubmittedForApproval(recommendation);
        log.info("Recommendation {} submitted for approval by {}", recommendation.getRecommendationNumber(), userId);
        return mapper.toResponse(recommendation);
    }

    // ------------------------------------------------------------------ queries

    @Override
    @Transactional(readOnly = true)
    public RecommendationResponse getById(UUID recommendationId) {
        return mapper.toResponse(repository.findById(recommendationId)
                .orElseThrow(() -> new RecommendationNotFoundException(recommendationId)));
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<RecommendationResponse> search(RecommendationStatus status, UUID procurementRequestId,
                                                       Pageable pageable) {
        Pageable sorted = pageable.getSort().isSorted() ? pageable
                : PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), DEFAULT_SORT);
        return PageResponse.from(repository.findAll(RecommendationRepository.filter(status, procurementRequestId),
                sorted), mapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public List<RecommendedVendorResponse> getRanking(UUID recommendationId) {
        return mapper.toRanking(load(recommendationId));
    }

    @Override
    @Transactional(readOnly = true)
    public RecommendationExplanationResponse getExplanation(UUID recommendationId) {
        return mapper.toExplanation(load(recommendationId));
    }

    // ------------------------------------------------------------------ helpers

    private record Prepared(ComparisonResults comparison, RecommendationPolicy policy,
                            RecommendationCalculationResult result) {
    }

    private Prepared prepare(UUID comparisonId, String policyCode, Map<RecommendationCriteria, BigDecimal> weights) {
        RecommendationPolicy policy = policies.get(policyCode == null ? DefaultRecommendationPolicy.CODE : policyCode);
        if (policy == null) {
            throw new InvalidRecommendationException("Unknown recommendation policy: " + policyCode);
        }
        ComparisonResults comparison = comparisonClient.getResults(comparisonId);
        if (!"COMPLETED".equals(comparison.comparison().status())) {
            throw new InvalidRecommendationException("Only COMPLETED comparisons can be recommended (current: "
                    + comparison.comparison().status() + ")");
        }
        ProcurementRequestInfo request = procurementClient.getProcurementRequest(
                comparison.comparison().procurementRequestId());
        Map<UUID, Optional<ValidationSummary>> validations = new HashMap<>();
        comparison.safeResults().forEach(r -> validations.put(r.quotationId(), validationClient.findLatest(r.quotationId())));

        RecommendationCalculationResult result = scoringService.recommend(comparison, request, validations, policy, weights);
        if (result.evaluations().stream().noneMatch(RecommendationCalculationResult.Evaluation::eligible)) {
            throw new NoEligibleVendorException(comparisonId);
        }
        return new Prepared(comparison, policy, result);
    }

    private Recommendation newRecommendation(Prepared p, UUID previousId, UUID sourceEventId, UUID generatedBy) {
        ComparisonResults.Header header = p.comparison().comparison();
        return new Recommendation(nextNumber(), header.procurementRequestId(), header.id(), header.comparisonNumber(),
                p.policy().code(), header.currencyCode(), previousId, sourceEventId, generatedBy, p.result());
    }

    private Recommendation persist(java.util.function.Supplier<Recommendation> work) {
        Recommendation saved = transactionTemplate.execute(status -> work.get());
        if (saved != null) {
            log.info("Recommendation {} for comparison {}: {} {}", saved.getRecommendationNumber(),
                    saved.getComparisonNumber(), saved.getType(), saved.getStatus());
        }
        return saved;
    }

    private Recommendation load(UUID id) {
        return repository.findWithItemsById(id).orElseThrow(() -> new RecommendationNotFoundException(id));
    }

    private String nextNumber() {
        String date = LocalDate.now(ZoneOffset.UTC).format(DateTimeFormatter.BASIC_ISO_DATE);
        for (int attempt = 0; attempt < 5; attempt++) {
            StringBuilder suffix = new StringBuilder();
            for (int i = 0; i < 6; i++) {
                suffix.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
            }
            String number = "REC-" + date + "-" + suffix;
            if (!repository.existsByRecommendationNumber(number)) {
                return number;
            }
        }
        throw new IllegalStateException("Could not generate a unique recommendation number");
    }
}
