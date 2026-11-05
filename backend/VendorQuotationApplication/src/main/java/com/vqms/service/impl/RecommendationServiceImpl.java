package com.vqms.service.impl;

import com.vqms.dto.request.RecommendationCriteriaRequest;
import com.vqms.dto.response.RecommendationResponse;
import com.vqms.entity.*;
import com.vqms.exception.BadRequestException;
import com.vqms.repository.*;
import com.vqms.service.RecommendationService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class RecommendationServiceImpl implements RecommendationService {

    private final RecommendationRepository recommendationRepository;
    private final QuotationRepository quotationRepository;
    private final VendorRepository vendorRepository;
    private final ApprovalRepository approvalRepository;

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    @Override
    public RecommendationResponse generateRecommendation(UUID requestId, UUID userId) {
        RecommendationCriteriaRequest defaultCriteria = new RecommendationCriteriaRequest();
        return generateRecommendationWithCriteria(requestId, userId, defaultCriteria);
    }

    @Override
    public RecommendationResponse generateRecommendationWithCriteria(UUID requestId, UUID userId, RecommendationCriteriaRequest criteria) {
        List<Quotation> quotations = quotationRepository
                .findByPurchaseRequestIdAndStatus(requestId, QuotationStatus.VALIDATED);

        if (quotations.isEmpty()) {
            throw new BadRequestException("No validated quotations found for recommendation");
        }

        // Normalize weights to sum to 100
        BigDecimal totalWeight = criteria.getPriceWeight()
                .add(criteria.getDeliveryWeight())
                .add(criteria.getQualityWeight())
                .add(criteria.getPaymentTermsWeight())
                .add(criteria.getVendorPerformanceWeight());

        if (totalWeight.compareTo(BigDecimal.ZERO) == 0) {
            throw new BadRequestException("Criteria weights cannot all be zero");
        }

        BigDecimal priceW = criteria.getPriceWeight().divide(totalWeight, 4, RoundingMode.HALF_UP).multiply(HUNDRED);
        BigDecimal deliveryW = criteria.getDeliveryWeight().divide(totalWeight, 4, RoundingMode.HALF_UP).multiply(HUNDRED);
        BigDecimal qualityW = criteria.getQualityWeight().divide(totalWeight, 4, RoundingMode.HALF_UP).multiply(HUNDRED);
        BigDecimal paymentW = criteria.getPaymentTermsWeight().divide(totalWeight, 4, RoundingMode.HALF_UP).multiply(HUNDRED);
        BigDecimal vendorW = criteria.getVendorPerformanceWeight().divide(totalWeight, 4, RoundingMode.HALF_UP).multiply(HUNDRED);

        // Find min/max prices for normalization
        BigDecimal minPrice = quotations.stream()
                .map(Quotation::getTotalAmount)
                .filter(p -> p != null && p.compareTo(BigDecimal.ZERO) > 0)
                .min(Comparator.naturalOrder())
                .orElse(BigDecimal.ONE);

        BigDecimal maxPrice = quotations.stream()
                .map(Quotation::getTotalAmount)
                .filter(p -> p != null && p.compareTo(BigDecimal.ZERO) > 0)
                .max(Comparator.naturalOrder())
                .orElse(BigDecimal.ONE);

        BigDecimal priceRange = maxPrice.subtract(minPrice);
        if (priceRange.compareTo(BigDecimal.ZERO) == 0) {
            priceRange = BigDecimal.ONE;
        }

        Quotation best = null;
        BigDecimal bestScore = BigDecimal.ZERO;
        BigDecimal bestPriceScore = BigDecimal.ZERO;
        BigDecimal bestDeliveryScore = BigDecimal.ZERO;
        BigDecimal bestQualityScore = BigDecimal.ZERO;
        BigDecimal bestPaymentScore = BigDecimal.ZERO;
        BigDecimal bestVendorScore = BigDecimal.ZERO;

        for (Quotation q : quotations) {
            // Price score: lower price = higher score (0-100)
            BigDecimal priceScore = BigDecimal.ZERO;
            if (q.getTotalAmount() != null && q.getTotalAmount().compareTo(BigDecimal.ZERO) > 0) {
                priceScore = priceRange.subtract(q.getTotalAmount().subtract(minPrice))
                        .divide(priceRange, 2, RoundingMode.HALF_UP)
                        .multiply(HUNDRED)
                        .min(HUNDRED).max(BigDecimal.ZERO);
            }

            // Delivery score: fewer days = higher score (0-100)
            BigDecimal deliveryScore = BigDecimal.ZERO;
            if (q.getDeliveryDays() != null && q.getDeliveryDays() > 0) {
                deliveryScore = HUNDRED.subtract(
                        BigDecimal.valueOf(q.getDeliveryDays()).multiply(BigDecimal.valueOf(2)).min(HUNDRED)
                ).max(BigDecimal.ZERO);
            } else if (q.getValidUntil() != null) {
                long daysLeft = ChronoUnit.DAYS.between(java.time.LocalDate.now(), q.getValidUntil());
                deliveryScore = daysLeft > 0
                        ? BigDecimal.valueOf(Math.min(daysLeft * 2, 100))
                        : BigDecimal.ZERO;
            }

            // Quality score based on extraction confidence and data completeness
            BigDecimal qualityScore = BigDecimal.valueOf(50);
            if (q.getExtractionConfidence() != null) {
                qualityScore = q.getExtractionConfidence().multiply(HUNDRED);
            }
            if (q.getNotes() != null && !q.getNotes().isEmpty()) {
                qualityScore = qualityScore.add(BigDecimal.valueOf(5));
            }
            if (q.getWarrantyPeriod() != null && !q.getWarrantyPeriod().isEmpty()) {
                qualityScore = qualityScore.add(BigDecimal.valueOf(10));
            }
            qualityScore = qualityScore.min(HUNDRED).max(BigDecimal.ZERO);

            // Payment terms score
            BigDecimal paymentScore = BigDecimal.valueOf(50);
            if (q.getPaymentTerms() != null && !q.getPaymentTerms().isEmpty()) {
                paymentScore = BigDecimal.valueOf(75);
                String terms = q.getPaymentTerms().toLowerCase();
                if (terms.contains("net 30") || terms.contains("30 days")) {
                    paymentScore = BigDecimal.valueOf(85);
                } else if (terms.contains("net 60") || terms.contains("60 days")) {
                    paymentScore = BigDecimal.valueOf(95);
                } else if (terms.contains("advance") || terms.contains("prepay")) {
                    paymentScore = BigDecimal.valueOf(40);
                }
            }
            paymentScore = paymentScore.min(HUNDRED).max(BigDecimal.ZERO);

            // Vendor performance score based on approval history
            BigDecimal vendorScore = BigDecimal.valueOf(70);
            Vendor vendor = vendorRepository.findById(q.getVendorId()).orElse(null);
            if (vendor != null) {
                if ("ACTIVE".equals(vendor.getStatus())) {
                    vendorScore = BigDecimal.valueOf(80);
                }
                // Count approved quotations for this vendor
                long approvedCount = approvalRepository.countByQuotationIdAndStatus(
                        q.getId(), ApprovalStatus.APPROVED);
                if (approvedCount > 0) {
                    vendorScore = vendorScore.add(BigDecimal.valueOf(approvedCount * 5));
                }
            }
            vendorScore = vendorScore.min(HUNDRED).max(BigDecimal.ZERO);

            // Weighted total score
            BigDecimal total = priceScore.multiply(priceW).divide(HUNDRED, 2, RoundingMode.HALF_UP)
                    .add(deliveryScore.multiply(deliveryW).divide(HUNDRED, 2, RoundingMode.HALF_UP))
                    .add(qualityScore.multiply(qualityW).divide(HUNDRED, 2, RoundingMode.HALF_UP))
                    .add(paymentScore.multiply(paymentW).divide(HUNDRED, 2, RoundingMode.HALF_UP))
                    .add(vendorScore.multiply(vendorW).divide(HUNDRED, 2, RoundingMode.HALF_UP));

            if (total.compareTo(bestScore) > 0) {
                bestScore = total;
                best = q;
                bestPriceScore = priceScore;
                bestDeliveryScore = deliveryScore;
                bestQualityScore = qualityScore;
                bestPaymentScore = paymentScore;
                bestVendorScore = vendorScore;
            }
        }

        if (best == null) {
            throw new BadRequestException("Could not generate recommendation");
        }

        // Build explanation
        List<String> factors = new ArrayList<>();
        factors.add(String.format("Price score: %.1f/100 (weight: %.0f%%)", bestPriceScore.doubleValue(), priceW.doubleValue()));
        factors.add(String.format("Delivery score: %.1f/100 (weight: %.0f%%)", bestDeliveryScore.doubleValue(), deliveryW.doubleValue()));
        factors.add(String.format("Quality score: %.1f/100 (weight: %.0f%%)", bestQualityScore.doubleValue(), qualityW.doubleValue()));
        factors.add(String.format("Payment terms score: %.1f/100 (weight: %.0f%%)", bestPaymentScore.doubleValue(), paymentW.doubleValue()));
        factors.add(String.format("Vendor performance score: %.1f/100 (weight: %.0f%%)", bestVendorScore.doubleValue(), vendorW.doubleValue()));

        Vendor bestVendor = vendorRepository.findById(best.getVendorId()).orElse(null);
        String vendorName = bestVendor != null ? bestVendor.getName() : "Unknown Vendor";

        String explanation = String.format(
                "Recommended: %s (Quotation #%s). Overall score: %.1f/100. Criteria: %s.",
                vendorName, best.getId(), bestScore.doubleValue(),
                String.join(", ", factors)
        );

        Recommendation recommendation = new Recommendation();
        recommendation.setPurchaseRequestId(requestId);
        recommendation.setRecommendedVendorId(best.getVendorId());
        recommendation.setRecommendedQuotationId(best.getId());
        recommendation.setRecommendationScore(bestScore);
        recommendation.setPriceScore(bestPriceScore);
        recommendation.setQualityScore(bestQualityScore);
        recommendation.setDeliveryScore(bestDeliveryScore);
        recommendation.setExplanation(explanation);
        recommendation.setCriteriaJson(String.format(
                "{\"priceWeight\":%s,\"deliveryWeight\":%s,\"qualityWeight\":%s,\"paymentTermsWeight\":%s,\"vendorPerformanceWeight\":%s}",
                criteria.getPriceWeight(), criteria.getDeliveryWeight(), criteria.getQualityWeight(),
                criteria.getPaymentTermsWeight(), criteria.getVendorPerformanceWeight()
        ));
        recommendation.setCreatedBy(userId);

        Recommendation saved = recommendationRepository.save(recommendation);
        return toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public RecommendationResponse getLatestRecommendation(UUID requestId) {
        return recommendationRepository.findFirstByPurchaseRequestIdOrderByCreatedAtDesc(requestId)
                .map(this::toResponse)
                .orElseThrow(() -> new EntityNotFoundException("No recommendation found"));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<RecommendationResponse> getRecommendationsByRequestId(UUID requestId, Pageable pageable) {
        return recommendationRepository.findByPurchaseRequestId(requestId, pageable).map(this::toResponse);
    }

    @Override
    public void deleteRecommendation(UUID id, UUID userId) {
        Recommendation recommendation = recommendationRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Recommendation not found"));
        recommendationRepository.delete(recommendation);
    }

    @Override
    @Transactional(readOnly = true)
    public List<RecommendationResponse> getAllRecommendationsForRequest(UUID requestId) {
        return recommendationRepository.findByPurchaseRequestId(requestId, Pageable.unpaged())
                .getContent().stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public RecommendationResponse getRecommendationById(UUID id) {
        Recommendation recommendation = recommendationRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Recommendation not found"));
        return toResponse(recommendation);
    }

    private RecommendationResponse toResponse(Recommendation recommendation) {
        RecommendationResponse response = new RecommendationResponse();
        response.setId(recommendation.getId());
        response.setPurchaseRequestId(recommendation.getPurchaseRequestId());
        response.setRecommendedVendorId(recommendation.getRecommendedVendorId());
        response.setRecommendedQuotationId(recommendation.getRecommendedQuotationId());
        response.setRecommendationScore(recommendation.getRecommendationScore());
        response.setPriceScore(recommendation.getPriceScore());
        response.setQualityScore(recommendation.getQualityScore());
        response.setDeliveryScore(recommendation.getDeliveryScore());
        response.setExplanation(recommendation.getExplanation());
        response.setCriteriaJson(recommendation.getCriteriaJson());
        response.setCreatedBy(recommendation.getCreatedBy());
        response.setCreatedAt(recommendation.getCreatedAt());

        Vendor vendor = vendorRepository.findById(recommendation.getRecommendedVendorId()).orElse(null);
        if (vendor != null) {
            response.setRecommendedVendorName(vendor.getName());
        }
        return response;
    }
}
