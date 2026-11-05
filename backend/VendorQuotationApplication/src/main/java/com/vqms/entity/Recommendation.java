package com.vqms.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "recommendations", indexes = {
        @Index(name = "idx_recommendation_request", columnList = "purchase_request_id")
})
@Getter
@Setter
@NoArgsConstructor
public class Recommendation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "purchase_request_id", nullable = false)
    private UUID purchaseRequestId;

    @Column(name = "recommended_vendor_id", nullable = false)
    private UUID recommendedVendorId;

    @Column(name = "recommended_quotation_id", nullable = false)
    private UUID recommendedQuotationId;

    @Column(name = "recommendation_score", precision = 5, scale = 2)
    private BigDecimal recommendationScore;

    @Column(name = "price_score", precision = 5, scale = 2)
    private BigDecimal priceScore;

    @Column(name = "quality_score", precision = 5, scale = 2)
    private BigDecimal qualityScore;

    @Column(name = "delivery_score", precision = 5, scale = 2)
    private BigDecimal deliveryScore;

    @Column(name = "explanation", columnDefinition = "TEXT")
    private String explanation;

    @Column(name = "criteria_json", columnDefinition = "TEXT")
    private String criteriaJson;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
