package com.vqms.approval.constants;

public final class ApprovalConstants {

    public static final String API_BASE_PATH = "/api/v1/approvals";
    public static final String POLICY_API_BASE_PATH = "/api/v1/approval-policies";

    public static final String AGGREGATE_TYPE = "APPROVAL";
    public static final String EVENT_APPROVAL_CREATED = "APPROVAL_CREATED";
    public static final String EVENT_APPROVAL_COMPLETED = "APPROVAL_COMPLETED";
    public static final String EVENT_APPROVAL_REJECTED = "APPROVAL_REJECTED";
    public static final String EVENT_APPROVAL_ESCALATED = "APPROVAL_ESCALATED";

    private ApprovalConstants() {
    }
}
