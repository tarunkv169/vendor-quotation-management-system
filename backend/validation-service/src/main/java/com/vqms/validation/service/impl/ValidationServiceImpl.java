package com.vqms.validation.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vqms.validation.client.ProcurementServiceClient;
import com.vqms.validation.client.QuotationServiceClient;
import com.vqms.validation.client.VendorServiceClient;
import com.vqms.validation.client.dto.QuotationData;
import com.vqms.validation.constants.ValidationConstants;
import com.vqms.validation.dto.internal.IssueDraft;
import com.vqms.validation.dto.internal.ValidationContext;
import com.vqms.validation.dto.internal.ValidationResult;
import com.vqms.validation.dto.request.ExtractionPayload;
import com.vqms.validation.dto.request.ValidationRequest;
import com.vqms.validation.dto.response.PageResponse;
import com.vqms.validation.dto.response.ValidationResponse;
import com.vqms.validation.entity.ValidationRecord;
import com.vqms.validation.enums.ValidationStatus;
import com.vqms.validation.enums.ValidationTrigger;
import com.vqms.validation.enums.ValidationType;
import com.vqms.validation.event.OutboxService;
import com.vqms.validation.event.ValidationEventPublisher;
import com.vqms.validation.exception.InvalidValidationRequestException;
import com.vqms.validation.exception.ValidationNotFoundException;
import com.vqms.validation.exception.ValidationProcessingException;
import com.vqms.validation.mapper.ValidationMapper;
import com.vqms.validation.repository.ProcessedMessageRepository;
import com.vqms.validation.repository.ValidationRepository;
import com.vqms.validation.security.AuthenticatedUser;
import com.vqms.validation.security.CurrentUserProvider;
import com.vqms.validation.service.ValidationService;
import com.vqms.validation.service.internal.ValidationEngine;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Orchestrates a validation run:
 * <ol>
 *   <li>load authoritative data (Quotation, Vendor, Procurement services) - no DB transaction is held
 *       during these network calls;</li>
 *   <li>run the pure ValidationEngine;</li>
 *   <li>in ONE transaction: save record + issues, write the outcome event to the outbox and,
 *       for messages, the inbox marker (idempotency).</li>
 * </ol>
 */
@Service
public class ValidationServiceImpl implements ValidationService {

    private static final Logger log = LoggerFactory.getLogger(ValidationServiceImpl.class);
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.DESC, "createdAt");

    private final ValidationRepository repository;
    private final ProcessedMessageRepository processedMessageRepository;
    private final QuotationServiceClient quotationClient;
    private final VendorServiceClient vendorClient;
    private final ProcurementServiceClient procurementClient;
    private final ValidationEngine engine;
    private final ValidationEventPublisher eventPublisher;
    private final OutboxService outboxService;
    private final ValidationMapper mapper;
    private final CurrentUserProvider currentUserProvider;
    private final TransactionTemplate transactionTemplate;
    private final ObjectMapper objectMapper;

    public ValidationServiceImpl(ValidationRepository repository,
                                 ProcessedMessageRepository processedMessageRepository,
                                 QuotationServiceClient quotationClient,
                                 VendorServiceClient vendorClient,
                                 ProcurementServiceClient procurementClient,
                                 ValidationEngine engine,
                                 ValidationEventPublisher eventPublisher,
                                 OutboxService outboxService,
                                 ValidationMapper mapper,
                                 CurrentUserProvider currentUserProvider,
                                 TransactionTemplate transactionTemplate,
                                 ObjectMapper objectMapper) {
        this.repository = repository;
        this.processedMessageRepository = processedMessageRepository;
        this.quotationClient = quotationClient;
        this.vendorClient = vendorClient;
        this.procurementClient = procurementClient;
        this.engine = engine;
        this.eventPublisher = eventPublisher;
        this.outboxService = outboxService;
        this.mapper = mapper;
        this.currentUserProvider = currentUserProvider;
        this.transactionTemplate = transactionTemplate;
        this.objectMapper = objectMapper;
    }

    // ------------------------------------------------------------------ commands

    @Override
    public ValidationResponse validate(ValidationRequest request) {
        AuthenticatedUser user = currentUserProvider.getCurrentUser();
        ValidationRecord record = run(request.quotationId(), Optional.ofNullable(request.extraction()),
                ValidationTrigger.MANUAL, user.userId(), null, null, request.extractionId(), request.documentId());
        return mapper.toResponse(record, true);
    }

    @Override
    public ValidationResponse revalidate(UUID validationId) {
        AuthenticatedUser user = currentUserProvider.getCurrentUser();
        ValidationRecord previous = repository.findById(validationId)
                .orElseThrow(() -> new ValidationNotFoundException(validationId));
        if (previous.getQuotationId() == null) {
            throw new InvalidValidationRequestException("Validation is not linked to a quotation");
        }
        ValidationRecord record = run(previous.getQuotationId(), readSnapshot(previous.getExtractionSnapshot()),
                ValidationTrigger.REVALIDATION, user.userId(), previous.getId(), null,
                previous.getExtractionId(), previous.getDocumentId());
        return mapper.toResponse(record, true);
    }

    private ValidationRecord run(UUID quotationId, Optional<ExtractionPayload> extraction, ValidationTrigger trigger,
                                 UUID requestedBy, UUID previousValidationId, UUID sourceEventId,
                                 UUID extractionId, UUID documentId) {
        // 1. Load authoritative data (outside any transaction).
        QuotationData quotation = quotationClient.getQuotation(quotationId);
        ValidationContext context = new ValidationContext(
                quotation,
                quotation.vendorId() == null ? Optional.empty() : vendorClient.findVendor(quotation.vendorId()),
                quotation.procurementRequestId() == null ? Optional.empty()
                        : procurementClient.findProcurementRequest(quotation.procurementRequestId()),
                quotation.procurementRequestId() == null ? List.of()
                        : quotationClient.listByProcurementRequest(quotation.procurementRequestId()),
                extraction,
                LocalDate.now(ZoneOffset.UTC));

        // 2. Pure validation.
        ValidationResult result = engine.run(context);

        // 3. Persist + outbox (+ inbox) atomically.
        ValidationRecord record = ValidationRecord.builder()
                .quotationId(quotation.id())
                .quotationNumber(quotation.quotationNumber())
                .quotationVersion(quotation.version())
                .vendorId(quotation.vendorId())
                .procurementRequestId(quotation.procurementRequestId())
                .extractionId(extractionId)
                .documentId(documentId)
                .trigger(trigger)
                .requestedBy(requestedBy)
                .previousValidationId(previousValidationId)
                .sourceEventId(sourceEventId)
                .currencyCode(quotation.currencyCode())
                .extractionSnapshot(extraction.map(this::writeSnapshot).orElse(null))
                .build();
        record.complete(result.issues(), result.expectedSubtotal(), result.expectedDiscount(),
                result.expectedTax(), result.expectedTotal(), quotation.totalAmount());
        ValidationRecord saved = persist(record, sourceEventId);
        log.info("Validation {} for quotation {}: {}", saved.getId(), quotationId, saved.getSummary());
        return saved;
    }

    private ValidationRecord persist(ValidationRecord record, UUID sourceEventId) {
        try {
            return transactionTemplate.execute(status -> {
                if (sourceEventId != null
                        && !outboxService.markProcessed(sourceEventId, ValidationConstants.EXTRACTION_CONSUMER)) {
                    status.setRollbackOnly();
                    return record;
                }
                ValidationRecord saved = repository.save(record);
                eventPublisher.publish(saved);
                return saved;
            });
        } catch (DataIntegrityViolationException ex) {
            if (sourceEventId != null) {
                log.info("Concurrent duplicate of event {} ignored", sourceEventId);
                return record;
            }
            throw new ValidationProcessingException("Validation could not be stored", ex);
        }
    }

    // ------------------------------------------------------------------ queries

    @Override
    @Transactional(readOnly = true)
    public ValidationResponse getById(UUID validationId) {
        ValidationRecord record = repository.findWithIssuesById(validationId)
                .orElseThrow(() -> new ValidationNotFoundException(validationId));
        assertCanRead(currentUserProvider.getCurrentUser(), record);
        return mapper.toResponse(record, true);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ValidationResponse> getByQuotation(UUID quotationId, Pageable pageable) {
        AuthenticatedUser user = currentUserProvider.getCurrentUser();
        UUID vendorFilter = user.isVendor() ? user.vendorId() : null;
        return PageResponse.from(repository.findAll(
                ValidationRepository.filter(null, quotationId, vendorFilter, null), withDefaultSort(pageable)),
                r -> mapper.toResponse(r, false));
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ValidationResponse> search(ValidationStatus status, UUID vendorId, UUID procurementRequestId,
                                                   Pageable pageable) {
        AuthenticatedUser user = currentUserProvider.getCurrentUser();
        UUID vendorFilter = vendorId;
        if (user.isVendor()) {
            if (vendorId != null && !vendorId.equals(user.vendorId())) {
                throw new AccessDeniedException("Vendors can only view their own validations");
            }
            vendorFilter = user.vendorId();
        }
        return PageResponse.from(repository.findAll(
                ValidationRepository.filter(status, null, vendorFilter, procurementRequestId),
                withDefaultSort(pageable)), r -> mapper.toResponse(r, false));
    }

    private static void assertCanRead(AuthenticatedUser user, ValidationRecord record) {
        if (user.isStaff()) {
            return;
        }
        if (user.isVendor() && Objects.equals(user.vendorId(), record.getVendorId())) {
            return;
        }
        throw new AccessDeniedException("You are not allowed to view this validation");
    }

    private static Pageable withDefaultSort(Pageable pageable) {
        return pageable.getSort().isSorted() ? pageable
                : PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), DEFAULT_SORT);
    }

    // ------------------------------------------------------------------ snapshot

    private String writeSnapshot(ExtractionPayload payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            throw new ValidationProcessingException("Extraction payload cannot be stored", ex);
        }
    }

    private Optional<ExtractionPayload> readSnapshot(String json) {
        if (json == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(objectMapper.readValue(json, ExtractionPayload.class));
        } catch (JsonProcessingException ex) {
            log.warn("Stored extraction snapshot is unreadable; revalidating without document checks");
            return Optional.empty();
        }
    }
}
