package com.vqms.approval.exception;

/** Operation not allowed in the current approval/step state (or missing rejection comment). HTTP 409. */
public class InvalidApprovalStateException extends RuntimeException {

    public InvalidApprovalStateException(String message) {
        super(message);
    }
}
