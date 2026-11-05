package com.vqms.audit.exception;

import java.util.UUID;

/** HTTP 404. */
public class AuditEventNotFoundException extends RuntimeException {

    public AuditEventNotFoundException(UUID id) {
        super("Audit event not found: " + id);
    }
}
