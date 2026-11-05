package com.vqms.audit.service;

import com.vqms.audit.dto.request.AuditEventRequest;
import com.vqms.audit.dto.response.AuditEventResponse;
import com.vqms.audit.dto.response.ChainVerificationResponse;
import com.vqms.audit.dto.response.PageResponse;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Audit trail use cases. There is deliberately no update or delete. */
public interface AuditService {

    AuditEventResponse record(AuditEventRequest request);

    AuditEventResponse append(AuditCommand command);

    AuditEventResponse get(UUID id);

    PageResponse<AuditEventResponse> search(String sourceService, String eventType, String aggregateType,
                                            UUID aggregateId, UUID actorId, Instant from, Instant to, Pageable pageable);

    List<AuditEventResponse> timeline(String aggregateType, UUID aggregateId);

    ChainVerificationResponse verifyChain();
}
