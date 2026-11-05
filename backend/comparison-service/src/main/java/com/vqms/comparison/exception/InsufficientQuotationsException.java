package com.vqms.comparison.exception;

/** Fewer eligible quotations than required for a meaningful comparison. HTTP 422. */
public class InsufficientQuotationsException extends RuntimeException {

    public InsufficientQuotationsException(int eligible, int required, String details) {
        super("Only " + eligible + " eligible quotation(s); at least " + required + " required. " + details);
    }
}
