package com.vqms.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
public class ProcurementItemRequest {

    @NotBlank(message = "Item description is required")
    @Size(min = 3, max = 200, message = "Description must contain between 3 and 200 characters")
    private String description;

    @NotNull(message = "Quantity is required")
    @Min(value = 1, message = "Quantity must be greater than zero")
    private Integer quantity;

    @NotBlank(message = "Unit is required")
    @Size(min = 2, max = 50, message = "Unit must contain between 2 and 50 characters")
    private String unit;

    @NotNull(message = "Expected unit price is required")
    private BigDecimal expectedUnitPrice;

    @Size(max = 100, message = "Category cannot exceed 100 characters")
    private String category;

    @Size(max = 5000, message = "Specification cannot exceed 5000 characters")
    private String specification;

    @Size(max = 20, message = "Priority cannot exceed 20 characters")
    private String priority;
}
