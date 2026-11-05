package com.vqms.approval.dto.request;

import com.vqms.approval.enums.ApprovalLevel;
import com.vqms.approval.enums.ApprovalMode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

/** Create/update an approval policy (administrators only). */
public record ApprovalPolicyRequest(
        @NotBlank @Pattern(regexp = "^[A-Z0-9_]{2,40}$") String code,
        @NotBlank @Size(max = 150) String name,
        @Size(max = 500) String description,
        @NotBlank @Pattern(regexp = "^[A-Z]{3}$") String currencyCode,
        @NotNull @DecimalMin("0") BigDecimal minAmount,
        @DecimalMin("0") BigDecimal maxAmount,
        @NotNull ApprovalMode mode,
        @NotEmpty @Size(max = 5) List<@Valid Level> levels,
        @NotBlank @Size(max = 40) String escalationRole,
        @Min(1) @Max(720) int escalationHours,
        @Min(0) @Max(1000) int priority
) {

    public record Level(
            @NotNull ApprovalLevel level,
            @NotBlank @Size(max = 40) String requiredRole,
            @NotNull @DecimalMin("0.01") BigDecimal approvalLimit,
            @Min(1) @Max(720) int deadlineHours
    ) {
    }
}
