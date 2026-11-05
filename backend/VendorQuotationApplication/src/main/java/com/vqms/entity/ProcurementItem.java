package com.vqms.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "procurement_items",
        indexes = {
                @Index(name = "idx_procurement_item_request", columnList = "procurement_request_id"),
                @Index(name = "idx_procurement_item_created_at", columnList = "created_at")
        }
)
@Getter
@Setter
@NoArgsConstructor
public class ProcurementItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 200)
    private String description;

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false, length = 50)
    private String unit;

    @Column(name = "expected_unit_price", precision = 15, scale = 2)
    private BigDecimal expectedUnitPrice;

    @Column(name = "category", length = 100)
    private String category;

    @Column(name = "specification", columnDefinition = "TEXT")
    private String specification;

    @Column(name = "priority", length = 20)
    private String priority;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "procurement_request_id", nullable = false)
    private ProcurementRequest procurementRequest;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
