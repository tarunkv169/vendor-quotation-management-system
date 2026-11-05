package com.vqms.approval.exception;

/** Missing, ambiguous or invalid approval policy (e.g. no level authorised for the amount). HTTP 422. */
public class ApprovalPolicyException extends RuntimeException {

    public ApprovalPolicyException(String message) {
        super(message);
    }
}
