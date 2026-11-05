package com.vqms.service.impl;

import com.vqms.dto.response.ComparisonLineResponse;
import com.vqms.dto.response.ComparisonResponse;
import com.vqms.entity.*;
import com.vqms.exception.BadRequestException;
import com.vqms.repository.*;
import com.vqms.service.ComparisonService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional
public class ComparisonServiceImpl implements ComparisonService {

    private final ComparisonRepository comparisonRepository;
    private final ComparisonLineRepository comparisonLineRepository;
    private final QuotationRepository quotationRepository;
    private final QuotationItemRepository quotationItemRepository;
    private final VendorRepository vendorRepository;

    @Override
    public ComparisonResponse generateComparison(UUID requestId, UUID userId) {
        List<Quotation> quotations = quotationRepository
                .findByPurchaseRequestIdAndStatus(requestId, QuotationStatus.VALIDATED);

        if (quotations.isEmpty()) {
            throw new BadRequestException("No validated quotations found for comparison");
        }

        Comparison comparison = new Comparison();
        comparison.setPurchaseRequestId(requestId);
        comparison.setComparisonName("Comparison for Request " + requestId);
        comparison.setCreatedBy(userId);
        Comparison saved = comparisonRepository.save(comparison);

        for (Quotation quotation : quotations) {
            Vendor vendor = vendorRepository.findById(quotation.getVendorId()).orElse(null);
            List<QuotationItem> items = quotationItemRepository.findByQuotationId(quotation.getId());

            // Detect missing fields
            List<String> missingFields = new ArrayList<>();
            if (quotation.getTotalAmount() == null) missingFields.add("totalAmount");
            if (quotation.getDeliveryDays() == null) missingFields.add("deliveryDays");
            if (quotation.getValidUntil() == null) missingFields.add("validUntil");
            if (quotation.getPaymentTerms() == null || quotation.getPaymentTerms().isEmpty()) missingFields.add("paymentTerms");
            if (quotation.getWarrantyPeriod() == null || quotation.getWarrantyPeriod().isEmpty()) missingFields.add("warrantyPeriod");

            for (QuotationItem item : items) {
                ComparisonLine line = new ComparisonLine();
                line.setComparisonId(saved.getId());
                line.setQuotationId(quotation.getId());
                line.setVendorName(vendor != null ? vendor.getName() : "Unknown");
                line.setItemName(item.getItemName());
                line.setQuantity(item.getQuantity());
                line.setUnitPrice(item.getUnitPrice());
                line.setTotalPrice(item.getLineTotal());
                line.setCurrency(item.getCurrency());
                line.setDeliveryDays(item.getDeliveryDays());
                if (quotation.getValidUntil() != null) {
                    line.setValidUntil(quotation.getValidUntil().toString());
                }
                line.setMissingFields(missingFields.isEmpty() ? null : String.join(", ", missingFields));
                comparisonLineRepository.save(line);
            }
        }

        return toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public ComparisonResponse getComparisonById(UUID id) {
        Comparison comparison = comparisonRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Comparison not found"));
        return toResponse(comparison);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ComparisonResponse> getComparisonsByRequestId(UUID requestId, Pageable pageable) {
        return comparisonRepository.findByPurchaseRequestId(requestId, pageable).map(this::toResponse);
    }

    @Override
    public void deleteComparison(UUID id, UUID userId) {
        Comparison comparison = comparisonRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Comparison not found"));
        comparisonLineRepository.deleteByComparisonId(id);
        comparisonRepository.delete(comparison);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getPriceVariance(UUID requestId) {
        List<Quotation> quotations = quotationRepository
                .findByPurchaseRequestIdAndStatus(requestId, QuotationStatus.VALIDATED);

        if (quotations.size() < 2) {
            throw new BadRequestException("At least 2 validated quotations needed for price variance");
        }

        List<Map<String, Object>> priceData = new ArrayList<>();
        BigDecimal minPrice = new BigDecimal("999999999999");
        BigDecimal maxPrice = new BigDecimal("-999999999999");
        BigDecimal totalPrices = BigDecimal.ZERO;
        String minVendor = "", maxVendor = "";

        for (Quotation q : quotations) {
            Vendor vendor = vendorRepository.findById(q.getVendorId()).orElse(null);
            BigDecimal price = q.getTotalAmount() != null ? q.getTotalAmount() : BigDecimal.ZERO;
            String vendorName = vendor != null ? vendor.getName() : "Unknown";

            if (price.compareTo(minPrice) < 0) { minPrice = price; minVendor = vendorName; }
            if (price.compareTo(maxPrice) > 0) { maxPrice = price; maxVendor = vendorName; }
            totalPrices = totalPrices.add(price);

            Map<String, Object> item = new HashMap<>();
            item.put("vendorId", q.getVendorId());
            item.put("vendorName", vendorName);
            item.put("quotationId", q.getId());
            item.put("totalAmount", price);
            item.put("currency", q.getCurrency());
            priceData.add(item);
        }

        BigDecimal avgPrice = totalPrices.divide(BigDecimal.valueOf(quotations.size()), 2, RoundingMode.HALF_UP);
        BigDecimal priceRange = maxPrice.subtract(minPrice);
        BigDecimal variancePercent = minPrice.compareTo(BigDecimal.ZERO) > 0
                ? priceRange.divide(minPrice, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
                : BigDecimal.ZERO;

        Map<String, Object> result = new HashMap<>();
        result.put("purchaseRequestId", requestId);
        result.put("quotationsCompared", quotations.size());
        result.put("minPrice", minPrice);
        result.put("minPriceVendor", minVendor);
        result.put("maxPrice", maxPrice);
        result.put("maxPriceVendor", maxVendor);
        result.put("averagePrice", avgPrice);
        result.put("priceRange", priceRange);
        result.put("variancePercent", variancePercent);
        result.put("priceData", priceData);
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getDeliveryComparison(UUID requestId) {
        List<Quotation> quotations = quotationRepository
                .findByPurchaseRequestIdAndStatus(requestId, QuotationStatus.VALIDATED);

        if (quotations.isEmpty()) {
            throw new BadRequestException("No validated quotations found for delivery comparison");
        }

        List<Map<String, Object>> deliveryData = new ArrayList<>();
        int minDays = Integer.MAX_VALUE;
        int maxDays = Integer.MIN_VALUE;
        String minVendor = "", maxVendor = "";

        for (Quotation q : quotations) {
            Vendor vendor = vendorRepository.findById(q.getVendorId()).orElse(null);
            String vendorName = vendor != null ? vendor.getName() : "Unknown";
            Integer days = q.getDeliveryDays() != null ? q.getDeliveryDays() : -1;

            if (days > 0 && days < minDays) { minDays = days; minVendor = vendorName; }
            if (days > 0 && days > maxDays) { maxDays = days; maxVendor = vendorName; }

            Map<String, Object> item = new HashMap<>();
            item.put("vendorId", q.getVendorId());
            item.put("vendorName", vendorName);
            item.put("quotationId", q.getId());
            item.put("deliveryDays", days);
            item.put("validUntil", q.getValidUntil());
            item.put("paymentTerms", q.getPaymentTerms());
            deliveryData.add(item);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("purchaseRequestId", requestId);
        result.put("quotationsCompared", quotations.size());
        result.put("fastestDelivery", minDays > 0 ? minDays : "N/A");
        result.put("fastestVendor", minVendor);
        result.put("slowestDelivery", maxDays > 0 ? maxDays : "N/A");
        result.put("slowestVendor", maxVendor);
        result.put("deliveryData", deliveryData);
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getMissingFieldsReport(UUID requestId) {
        List<Quotation> quotations = quotationRepository
                .findByPurchaseRequestIdAndStatus(requestId, QuotationStatus.VALIDATED);

        List<Map<String, Object>> report = new ArrayList<>();
        for (Quotation q : quotations) {
            Vendor vendor = vendorRepository.findById(q.getVendorId()).orElse(null);
            List<String> missing = new ArrayList<>();
            if (q.getTotalAmount() == null) missing.add("totalAmount");
            if (q.getDeliveryDays() == null) missing.add("deliveryDays");
            if (q.getValidUntil() == null) missing.add("validUntil");
            if (q.getPaymentTerms() == null || q.getPaymentTerms().isEmpty()) missing.add("paymentTerms");
            if (q.getWarrantyPeriod() == null || q.getWarrantyPeriod().isEmpty()) missing.add("warrantyPeriod");
            if (q.getTaxAmount() == null) missing.add("taxAmount");
            if (q.getDiscountAmount() == null) missing.add("discountAmount");

            Map<String, Object> item = new HashMap<>();
            item.put("vendorId", q.getVendorId());
            item.put("vendorName", vendor != null ? vendor.getName() : "Unknown");
            item.put("quotationId", q.getId());
            item.put("missingFields", missing);
            item.put("missingCount", missing.size());
            item.put("completeness", missing.isEmpty() ? "100%" :
                    String.format("%.0f%%", (1.0 - (double) missing.size() / 7.0) * 100));
            report.add(item);
        }
        return report;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ComparisonResponse> getAllComparisonsForRequest(UUID requestId) {
        return comparisonRepository.findByPurchaseRequestId(requestId).stream()
                .map(this::toResponse)
                .toList();
    }

    private ComparisonResponse toResponse(Comparison comparison) {
        ComparisonResponse response = new ComparisonResponse();
        response.setId(comparison.getId());
        response.setPurchaseRequestId(comparison.getPurchaseRequestId());
        response.setComparisonName(comparison.getComparisonName());
        response.setCreatedBy(comparison.getCreatedBy());
        response.setCreatedAt(comparison.getCreatedAt());
        response.setUpdatedAt(comparison.getUpdatedAt());

        List<ComparisonLine> lines = comparisonLineRepository.findByComparisonId(comparison.getId());
        List<ComparisonLineResponse> lineResponses = new ArrayList<>();
        for (ComparisonLine line : lines) {
            ComparisonLineResponse lineResp = new ComparisonLineResponse();
            lineResp.setId(line.getId());
            lineResp.setComparisonId(line.getComparisonId());
            lineResp.setQuotationId(line.getQuotationId());
            lineResp.setVendorName(line.getVendorName());
            lineResp.setItemName(line.getItemName());
            lineResp.setQuantity(line.getQuantity());
            lineResp.setUnitPrice(line.getUnitPrice());
            lineResp.setTotalPrice(line.getTotalPrice());
            lineResp.setCurrency(line.getCurrency());
            lineResp.setDeliveryDays(line.getDeliveryDays());
            lineResp.setValidUntil(line.getValidUntil());
            lineResp.setMissingFields(line.getMissingFields());
            lineResponses.add(lineResp);
        }
        response.setLines(lineResponses);
        return response;
    }
}
