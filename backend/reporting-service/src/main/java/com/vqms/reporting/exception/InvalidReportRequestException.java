package com.vqms.reporting.exception;

/** Missing or invalid report parameters. HTTP 400. */
public class InvalidReportRequestException extends RuntimeException {

    public InvalidReportRequestException(String message) {
        super(message);
    }
}
