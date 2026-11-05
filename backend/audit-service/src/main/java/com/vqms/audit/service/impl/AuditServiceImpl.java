package com.vqms.audit.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vqms.audit.config.AuditProperties;
import com.vqms.audit.config.CorrelationIdFilter;
import com.vqms.audit.constants.AuditConstants;
import com.vqms.audit.dto.request.AuditEventRequest;
import com.vqms.audit.dto.response.AuditEventResponse;
import com.vqms.audit.dto.response.ChainVerificationResponse;
import com.vqms.audit.dto.response.PageResponse;
import com.vqms.audit.entity.AuditChainHead;
import com.vqms.audit.entity.AuditEvent;
import com.vqms.audit.enums.AuditOutcome;
import com.vqms.audit.exception.AuditEventNotFoundException;
import com.vqms.audit.exception.InvalidAuditEventException;
import com.vqms.audit.repository.AuditChainHeadRepository;
import com.vqms.audit.repository.AuditEventRepository;
import com.vqms.audit.security.AuthenticatedUser;
import com.vqms.audit.security.CurrentUserProvider;
import com.vqms.audit.service.AuditCommand;
import com.vqms.audit.service.AuditService;
import com.vqms.audit.util.AuditHashCalculator;
import jakarta.persistence.EntityManager;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Appends to a single SHA-256 hash chain. Appends are serialized by locking the chain head row
 * (SELECT ... FOR UPDATE), so sequence numbers have no gaps and each record links to its predecessor.
 * Timestamps are truncated to microseconds - PostgreSQL's precision - so a stored record re-hashes
 * to exactly the same value during verification.
 */
@Service
public class AuditServiceImpl implements AuditService {

    private static final int VERIFY_BATCH = 500;

    private final AuditEventRepository repository;
    private final AuditChainHeadRepository headRepository;
    private final EntityManager entityManager;
    private final CurrentUserProvider currentUserProvider;
    private final ObjectMapper objectMapper;
    private final AuditProperties properties;

    public AuditServiceImpl(AuditEventRepository repository, AuditChainHeadRepository headRepository,
                            EntityManager entityManager, CurrentUserProvider currentUserProvider,
                            ObjectMapper objectMapper, AuditProperties properties) {
        this.repository = repository;
        this.headRepository = headRepository;
        this.entityManager = entityManager;
        this.currentUserProvider = currentUserProvider;
        this.objectMapper = objectMapper;
        this.properties = properties;
    }

    @Override
    @Transactional
    public AuditEventResponse record(AuditEventRequest r) {
        AuthenticatedUser caller = currentUserProvider.getCurrentUser();
        // Identity is never taken from the body for human callers.
        UUID actorId = caller.isInternalService() && r.actorId() != null ? r.actorId() : caller.userId();
        String actorRole = caller.isInternalService() && r.actorRole() != null ? r.actorRole() : caller.role();
        String payload = null;
        if (r.payload() != null && !r.payload().isNull()) {
            try {
                payload = objectMapper.writeValueAsString(r.payload());
            } catch (JsonProcessingException ex) {
                throw new InvalidAuditEventException("Payload is not valid JSON");
            }
        }
        return append(new AuditCommand(r.eventId() != null ? r.eventId() : UUID.randomUUID(), caller.username(),
                r.eventType(), r.aggregateType(), r.aggregateId(), actorId, actorRole,
                r.outcome() != null ? r.outcome() : AuditOutcome.SUCCESS, r.description(),
                CorrelationIdFilter.currentOrNew(), payload, r.occurredAt()));
    }

    @Override
    @Transactional
    public AuditEventResponse append(AuditCommand c) {
        if (c.payload() != null && c.payload().getBytes(StandardCharsets.UTF_8).length > properties.maxPayloadBytes()) {
            throw new InvalidAuditEventException("Payload exceeds " + properties.maxPayloadBytes() + " bytes");
        }
        Optional<AuditEvent> existing = repository.findByEventId(c.eventId());
        if (existing.isPresent()) {
            return toResponse(existing.get());
        }
        AuditChainHead head = headRepository.lockHead()
                .orElseThrow(() -> new IllegalStateException("Audit chain head row is missing"));
        // Re-check under the lock: a concurrent writer may have recorded the same event meanwhile.
        existing = repository.findByEventId(c.eventId());
        if (existing.isPresent()) {
            return toResponse(existing.get());
        }
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        Instant occurredAt = c.occurredAt() == null ? now : c.occurredAt().truncatedTo(ChronoUnit.MICROS);
        long sequence = head.getLastSequence() + 1;
        String description = c.description() == null || c.description().length() <= 1000
                ? c.description() : c.description().substring(0, 1000);
        String hash = AuditHashCalculator.hash(sequence, c.eventId(), c.sourceService(), c.eventType(),
                c.aggregateType(), c.aggregateId(), c.actorId(), c.actorRole(), c.outcome(), description,
                c.correlationId(), c.payload(), occurredAt, head.getLastHash());

        AuditEvent event = AuditEvent.builder()
                .id(UUID.randomUUID()).sequenceNumber(sequence).eventId(c.eventId())
                .sourceService(c.sourceService()).eventType(c.eventType()).aggregateType(c.aggregateType())
                .aggregateId(c.aggregateId()).actorId(c.actorId()).actorRole(c.actorRole()).outcome(c.outcome())
                .description(description).correlationId(c.correlationId()).payload(c.payload())
                .occurredAt(occurredAt).recordedAt(now).previousHash(head.getLastHash()).hash(hash)
                .build();
        entityManager.persist(event);
        head.advance(sequence, hash);
        return toResponse(event);
    }

    @Override
    @Transactional(readOnly = true)
    public AuditEventResponse get(UUID id) {
        return toResponse(repository.findById(id).orElseThrow(() -> new AuditEventNotFoundException(id)));
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AuditEventResponse> search(String sourceService, String eventType, String aggregateType,
                                                   UUID aggregateId, UUID actorId, Instant from, Instant to,
                                                   Pageable pageable) {
        Pageable sorted = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
                Sort.by(Sort.Direction.DESC, "sequenceNumber"));
        return PageResponse.from(repository.findAll(AuditEventRepository.filter(sourceService, eventType,
                aggregateType, aggregateId, actorId, from, to), sorted), this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AuditEventResponse> timeline(String aggregateType, UUID aggregateId) {
        return repository.findByAggregateTypeAndAggregateIdOrderBySequenceNumberAsc(aggregateType, aggregateId)
                .stream().map(this::toResponse).toList();
    }

    /** Walks the whole chain: sequence continuity, links and content hashes, then the head. */
    @Override
    @Transactional(readOnly = true)
    public ChainVerificationResponse verifyChain() {
        long expectedSequence = 1;
        String expectedPrevious = AuditConstants.GENESIS_HASH;
        long checked = 0;
        long after = 0;
        while (true) {
            Slice<AuditEvent> slice = repository.findBySequenceNumberGreaterThanOrderBySequenceNumberAsc(after,
                    PageRequest.of(0, VERIFY_BATCH));
            for (AuditEvent e : slice) {
                if (e.getSequenceNumber() != expectedSequence) {
                    return broken(checked, expectedSequence, "Sequence gap: record " + expectedSequence + " is missing");
                }
                if (!e.getPreviousHash().equals(expectedPrevious)) {
                    return broken(checked, e.getSequenceNumber(), "Link to the previous record does not match");
                }
                if (!AuditHashCalculator.hash(e).equals(e.getHash())) {
                    return broken(checked, e.getSequenceNumber(), "Record content does not match its hash");
                }
                expectedPrevious = e.getHash();
                expectedSequence++;
                checked++;
                after = e.getSequenceNumber();
                entityManager.detach(e);
            }
            if (!slice.hasNext()) {
                break;
            }
        }
        AuditChainHead head = headRepository.findById(AuditChainHead.ID).orElseThrow();
        if (head.getLastSequence() != checked || !head.getLastHash().equals(expectedPrevious)) {
            return broken(checked, checked + 1, "Chain head does not match the last record (records removed?)");
        }
        return new ChainVerificationResponse(true, checked, null, null, Instant.now());
    }

    private static ChainVerificationResponse broken(long checked, long sequence, String reason) {
        return new ChainVerificationResponse(false, checked, sequence, reason, Instant.now());
    }

    private AuditEventResponse toResponse(AuditEvent e) {
        return new AuditEventResponse(e.getId(), e.getSequenceNumber(), e.getEventId(), e.getSourceService(),
                e.getEventType(), e.getAggregateType(), e.getAggregateId(), e.getActorId(), e.getActorRole(),
                e.getOutcome(), e.getDescription(), e.getCorrelationId(), e.getPayload(), e.getOccurredAt(),
                e.getRecordedAt(), e.getHash());
    }
}
