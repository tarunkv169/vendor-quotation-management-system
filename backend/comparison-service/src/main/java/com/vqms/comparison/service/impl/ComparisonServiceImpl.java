package com.vqms.comparison.service.impl;

import com.vqms.comparison.calculator.ComparisonScoreCalculator;
import com.vqms.comparison.client.ProcurementServiceClient;
import com.vqms.comparison.client.QuotationServiceClient;
import com.vqms.comparison.client.ValidationServiceClient;
import com.vqms.comparison.client.dto.ProcurementRequestDetails;
import com.vqms.comparison.client.dto.QuotationDetails;
import com.vqms.comparison.constants.ComparisonConstants;
import com.vqms.comparison.dto.internal.ComparisonCalculationResult;
import com.vqms.comparison.dto.request.ComparisonCriteriaRequest;
import com.vqms.comparison.dto.request.ComparisonRequest;
import com.vqms.comparison.dto.request.ManualScoreRequest;
import com.vqms.comparison.dto.response.ComparisonResponse;
import com.vqms.comparison.dto.response.ComparisonResultResponse;
import com.vqms.comparison.dto.response.PageResponse;
import com.vqms.comparison.dto.response.VendorComparisonResponse;
import com.vqms.comparison.entity.Comparison;
import com.vqms.comparison.entity.json.ManualScore;
import com.vqms.comparison.enums.ComparisonCriteria;
import com.vqms.comparison.enums.ComparisonStatus;
import com.vqms.comparison.event.ComparisonEventPublisher;
import com.vqms.comparison.exception.ComparisonNotFoundException;
import com.vqms.comparison.exception.IncompatibleCurrencyException;
import com.vqms.comparison.exception.InsufficientQuotationsException;
import com.vqms.comparison.exception.InvalidComparisonException;
import com.vqms.comparison.mapper.ComparisonMapper;
import com.vqms.comparison.repository.ComparisonRepository;
import com.vqms.comparison.security.AuthenticatedUser;
import com.vqms.comparison.security.CurrentUserProvider;
import com.vqms.comparison.service.ComparisonService;
import com.vqms.comparison.service.internal.ComparisonEngine;
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
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Comparison workflow. Network calls (Quotation, Procurement, Validation services) are made
 * outside database transactions; results are applied in one short transaction together with
 * the outbox event.
 */
@Service
public class ComparisonServiceImpl implements ComparisonService {

    private static final Logger log = LoggerFactory.getLogger(ComparisonServiceImpl.class);
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.DESC, "createdAt");
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final ComparisonRepository repository;
    private final QuotationServiceClient quotationClient;
    private final ProcurementServiceClient procurementClient;
    private final ValidationServiceClient validationClient;
    private final ComparisonEngine engine;
    private final ComparisonEventPublisher eventPublisher;
    private final ComparisonMapper mapper;
    private final CurrentUserProvider currentUserProvider;
    private final TransactionTemplate transactionTemplate;

    public ComparisonServiceImpl(ComparisonRepository repository, QuotationServiceClient quotationClient,
                                 ProcurementServiceClient procurementClient, ValidationServiceClient validationClient,
                                 ComparisonEngine engine, ComparisonEventPublisher eventPublisher,
                                 ComparisonMapper mapper,
                                 CurrentUserProvider currentUserProvider, TransactionTemplate transactionTemplate) {
        this.repository = repository;
        this.quotationClient = quotationClient;
        this.procurementClient = procurementClient;
        this.validationClient = validationClient;
        this.engine = engine;
        this.eventPublisher = eventPublisher;
        this.mapper = mapper;
        this.currentUserProvider = currentUserProvider;
        this.transactionTemplate = transactionTemplate;
    }

    // ------------------------------------------------------------------ commands

    @Override
    public ComparisonResponse create(ComparisonRequest request) {
        AuthenticatedUser user = currentUserProvider.getCurrentUser();
        Map<ComparisonCriteria, BigDecimal> weights = new EnumMap<>(ComparisonCriteria.class);
        Map<ComparisonCriteria, BigDecimal> minimums = new EnumMap<>(ComparisonCriteria.class);
        for (ComparisonCriteriaRequest c : request.criteria()) {
            if (weights.put(c.criterion(), c.weight()) != null) {
                throw new InvalidComparisonException("Criterion " + c.criterion() + " is listed more than once");
            }
            if (c.minimumScore() != null) {
                minimums.put(c.criterion(), c.minimumScore());
            }
        }
        ComparisonScoreCalculator.validateWeights(weights);
        List<ManualScore> manualScores = toManualScores(request.manualScores(), user.userId());

        procurementClient.getProcurementRequest(request.procurementRequestId()); // must exist

        Comparison comparison = Comparison.builder()
                .comparisonNumber(nextComparisonNumber())
                .procurementRequestId(request.procurementRequestId())
                .currencyCode(request.currencyCode())
                .criteriaWeights(weights)
                .minimumScores(minimums)
                .manualScores(manualScores)
                .requestedQuotationIds(request.quotationIds() == null ? List.of() : List.copyOf(request.quotationIds()))
                .requireAllItems(request.requireAllItems())
                .createdBy(user.userId())
                .build();
        Comparison saved = transactionTemplate.execute(status -> repository.save(comparison));
        log.info("Comparison {} created for procurement request {}", saved.getComparisonNumber(),
                saved.getProcurementRequestId());
        return mapper.toResponse(saved);
    }

    @Override
    public ComparisonResultResponse calculate(UUID comparisonId) {
        Comparison snapshot = repository.findById(comparisonId)
                .orElseThrow(() -> new ComparisonNotFoundException(comparisonId));
        if (!snapshot.getStatus().canCalculate()) {
            throw new InvalidComparisonException("A COMPLETED comparison cannot be recalculated");
        }

        // Load authoritative data (no transaction held).
        ProcurementRequestDetails request = procurementClient.getProcurementRequest(snapshot.getProcurementRequestId());
        List<UUID> quotationIds = snapshot.getRequestedQuotationIds() == null || snapshot.getRequestedQuotationIds().isEmpty()
                ? quotationClient.listQuotationIds(snapshot.getProcurementRequestId())
                : snapshot.getRequestedQuotationIds();
        List<ComparisonEngine.Candidate> candidates = new ArrayList<>();
        for (UUID quotationId : new HashSet<>(quotationIds)) {
            Optional<QuotationDetails> quotation = quotationClient.findQuotation(quotationId);
            if (quotation.isEmpty()) {
                log.warn("Quotation {} not found; skipped", quotationId);
                continue;
            }
            if (!snapshot.getProcurementRequestId().equals(quotation.get().procurementRequestId())) {
                throw new InvalidComparisonException("Quotation " + quotationId
                        + " does not belong to procurement request " + snapshot.getProcurementRequestId());
            }
            candidates.add(new ComparisonEngine.Candidate(quotation.get(), validationClient.findLatest(quotationId)));
        }

        ComparisonCalculationResult result;
        try {
            result = engine.calculate(request, candidates, snapshot.getCriteriaWeights(), snapshot.getMinimumScores(),
                    snapshot.getManualScores(), snapshot.isRequireAllItems(), snapshot.getCurrencyCode(),
                    LocalDate.now(ZoneOffset.UTC));
        } catch (InsufficientQuotationsException | IncompatibleCurrencyException ex) {
            transactionTemplate.executeWithoutResult(status -> {
                Comparison comparison = load(comparisonId);
                comparison.markFailed(ex.getMessage());
                eventPublisher.publishFailed(comparison, ex.getMessage());
            });
            throw ex;
        }

        Comparison updated = transactionTemplate.execute(status -> {
            Comparison comparison = load(comparisonId);
            comparison.applyCalculation(result);
            return repository.saveAndFlush(comparison);
        });
        log.info("Comparison {} calculated: {} eligible, lowest {}", updated.getComparisonNumber(),
                updated.getEligibleCount(), updated.getLowestQuotationId());
        return mapper.toResultResponse(updated);
    }

    @Override
    @Transactional
    public ComparisonResponse complete(UUID comparisonId) {
        Comparison comparison = load(comparisonId);
        comparison.complete();
        eventPublisher.publishCompleted(comparison);
        log.info("Comparison {} completed", comparison.getComparisonNumber());
        return mapper.toResponse(comparison);
    }

    // ------------------------------------------------------------------ queries

    @Override
    @Transactional(readOnly = true)
    public ComparisonResponse getById(UUID comparisonId) {
        return mapper.toResponse(repository.findById(comparisonId)
                .orElseThrow(() -> new ComparisonNotFoundException(comparisonId)));
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ComparisonResponse> search(ComparisonStatus status, UUID procurementRequestId,
                                                   Pageable pageable) {
        Pageable sorted = pageable.getSort().isSorted() ? pageable
                : PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), DEFAULT_SORT);
        return PageResponse.from(repository.findAll(ComparisonRepository.filter(status, procurementRequestId), sorted),
                mapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public ComparisonResultResponse getResults(UUID comparisonId) {
        return mapper.toResultResponse(load(comparisonId));
    }

    @Override
    @Transactional(readOnly = true)
    public List<VendorComparisonResponse> getRanking(UUID comparisonId) {
        return mapper.sorted(load(comparisonId).getItems(), true);
    }

    // ------------------------------------------------------------------ helpers

    private Comparison load(UUID comparisonId) {
        return repository.findWithItemsById(comparisonId)
                .orElseThrow(() -> new ComparisonNotFoundException(comparisonId));
    }

    private static List<ManualScore> toManualScores(List<ManualScoreRequest> requests, UUID enteredBy) {
        if (requests == null) {
            return List.of();
        }
        Set<String> seen = new HashSet<>();
        List<ManualScore> scores = new ArrayList<>();
        for (ManualScoreRequest r : requests) {
            if (r.criterion() == ComparisonCriteria.PRICE || r.criterion() == ComparisonCriteria.DELIVERY_TIME
                    || r.criterion() == ComparisonCriteria.WARRANTY) {
                throw new InvalidComparisonException(r.criterion()
                        + " is calculated from quotation data and cannot be scored manually");
            }
            if (!seen.add(r.quotationId() + ":" + r.criterion())) {
                throw new InvalidComparisonException("Duplicate manual score for quotation " + r.quotationId()
                        + " and criterion " + r.criterion());
            }
            scores.add(new ManualScore(r.quotationId(), r.criterion(), r.score(), r.justification(), enteredBy));
        }
        return scores;
    }

    private String nextComparisonNumber() {
        String date = LocalDate.now(ZoneOffset.UTC).format(DateTimeFormatter.BASIC_ISO_DATE);
        for (int attempt = 0; attempt < 5; attempt++) {
            StringBuilder suffix = new StringBuilder();
            for (int i = 0; i < 6; i++) {
                suffix.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
            }
            String number = "CMP-" + date + "-" + suffix;
            if (!repository.existsByComparisonNumber(number)) {
                return number;
            }
        }
        throw new IllegalStateException("Could not generate a unique comparison number");
    }
}
