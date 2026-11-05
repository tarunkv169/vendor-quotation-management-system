
package com.vqms.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class ProcurementRequestRequest {

    @NotBlank(message = "Procurement request title is required")
    @Size(
            min = 3,
            max = 150,
            message = "Title must contain between 3 and 150 characters"
    )
    private String title;

    @NotBlank(message = "Procurement request description is required")
    @Size(
            min = 10,
            max = 5000,
            message = "Description must contain between 10 and 5000 characters"
    )
    private String description;

    @NotNull(message = "Quantity is required")
    @Min(
            value = 1,
            message = "Quantity must be greater than zero"
    )
    private Integer quantity;

    @NotBlank(message = "Unit is required")
    @Size(
            min = 2,
            max = 100,
            message = "Unit must contain between 2 and 100 characters"
    )
    private String unit;

    @NotNull(message = "Required delivery date is required")
    @Future(message = "Required delivery date must be in the future")
    private LocalDateTime requiredBy;

    private BigDecimal budget;

    @Valid
    private List<ProcurementItemRequest> items;
}
