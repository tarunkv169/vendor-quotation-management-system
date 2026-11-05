package com.vqms.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ApprovalDecisionRequest {

    @NotBlank(message = "Decision is required")
    @Size(max = 50, message = "Decision cannot exceed 50 characters")
    private String decision;

    @Size(max = 5000, message = "Comment cannot exceed 5000 characters")
    private String comment;
}
