package com.vqms.comparison.event;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vqms.comparison.config.CorrelationIdFilter;
import com.vqms.comparison.entity.OutboxEvent;
import com.vqms.comparison.entity.ProcessedMessage;
import com.vqms.comparison.repository.OutboxEventRepository;
import com.vqms.comparison.repository.ProcessedMessageRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Writes outbox events and inbox markers. {@code Propagation.MANDATORY} enforces that both are
 * always called inside the caller's business transaction (never on their own).
 */
@Service
public class OutboxService {

    private final OutboxEventRepository outboxRepository;
    private final ProcessedMessageRepository processedMessageRepository;
    private final ObjectMapper objectMapper;

    public OutboxService(OutboxEventRepository outboxRepository,
                         ProcessedMessageRepository processedMessageRepository, ObjectMapper objectMapper) {
        this.outboxRepository = outboxRepository;
        this.processedMessageRepository = processedMessageRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void enqueue(UUID eventId, String aggregateType, UUID aggregateId, String eventType,
                        String topic, Object payload) {
        try {
            String json = objectMapper.writeValueAsString(payload);
            outboxRepository.save(new OutboxEvent(eventId, aggregateType, aggregateId, eventType, topic, json,
                    CorrelationIdFilter.currentOrNew()));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Event payload cannot be serialized", ex);
        }
    }

    /** Returns false when the message was already processed (duplicate delivery). */
    @Transactional(propagation = Propagation.MANDATORY)
    public boolean markProcessed(UUID messageId, String consumer) {
        if (processedMessageRepository.existsById(messageId)) {
            return false;
        }
        processedMessageRepository.save(new ProcessedMessage(messageId, consumer));
        return true;
    }
}
