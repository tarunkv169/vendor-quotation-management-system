package com.vqms.approval.exception;

/** HTTP 404. */
public class ApprovalNotFoundException extends RuntimeException {

    public ApprovalNotFoundException(String message) {
        super(message);
    }
}
