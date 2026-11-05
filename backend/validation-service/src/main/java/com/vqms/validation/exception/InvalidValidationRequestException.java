package com.vqms.validation.exception;

/** The request references something that cannot be validated (e.g. unknown quotation). HTTP 400. */
public class InvalidValidationRequestException extends RuntimeException {

    public InvalidValidationRequestException(String message) {
        super(message);
    }
}
