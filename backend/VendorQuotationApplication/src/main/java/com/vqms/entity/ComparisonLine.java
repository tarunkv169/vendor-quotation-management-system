package com.vqms.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "comparison_lines", indexes = {
        @Index(name = "idx_comparison_line_comparison", columnList = "comparison_id")
})
@Getter
@Setter
@NoArgsConstructor
public class ComparisonLine {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "comparison_id", nullable = false)
    private UUID comparisonId;

    @Column(name = "quotation_id", nullable = false)
    private UUID quotationId;

    @Column(name = "vendor_name", length = 150)
    private String vendorName;

    @Column(name = "item_name", length = 255)
    private String itemName;

    @Column(name = "quantity")
    private Integer quantity;

    @Column(name = "unit_price", precision = 19, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "total_price", precision = 19, scale = 2)
    private BigDecimal totalPrice;

    @Column(name = "currency", length = 3)
    private String currency = "USD";

    @Column(name = "delivery_days")
    private Integer deliveryDays;

    @Column(name = "valid_until")
    private String validUntil;

    @Column(name = "missing_fields", columnDefinition = "TEXT")
    private String missingFields;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
