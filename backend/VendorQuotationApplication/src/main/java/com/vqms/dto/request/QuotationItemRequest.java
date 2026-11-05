package com.vqms.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class QuotationItemRequest {

    @NotBlank(message = "Item name is required")
    @Size(max = 255)
    private String itemName;

    @Size(max = 5000)
    private String description;

    @NotNull(message = "Quantity is required")
    @Min(value = 1, message = "Quantity must be at least 1")
    private Integer quantity;

    @NotBlank(message = "Unit is required")
    @Size(max = 50)
    private String unit;

    @NotNull(message = "Unit price is required")
    @DecimalMin(value = "0.00", message = "Unit price must be non-negative")
    private BigDecimal unitPrice;

    private String currency = "USD";

    @Size(max = 5000)
    private String specification;

    @Min(value = 0, message = "Delivery days must be non-negative")
    private Integer deliveryDays;
}
