package com.vqms.approval.exception;

/** The user may not decide this approval (role, self-approval, segregation of duties). HTTP 403. */
public class UnauthorizedApproverException extends RuntimeException {

    public UnauthorizedApproverException(String message) {
        super(message);
    }
}
