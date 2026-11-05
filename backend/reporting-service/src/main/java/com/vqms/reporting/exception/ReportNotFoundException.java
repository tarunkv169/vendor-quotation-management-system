package com.vqms.reporting.exception;

import java.util.UUID;

/** HTTP 404. */
public class ReportNotFoundException extends RuntimeException {

    public ReportNotFoundException(UUID id) {
        super("Report not found: " + id);
    }
}
