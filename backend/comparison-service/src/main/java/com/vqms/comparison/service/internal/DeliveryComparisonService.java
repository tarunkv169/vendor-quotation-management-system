package com.vqms.comparison.service.internal;

import com.vqms.comparison.client.dto.QuotationDetails;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;

/**
 * Delivery and warranty metrics per quotation.
 * Delivery = the longest line lead time (the order is complete only when the last line arrives).
 * Warranty = the shortest line warranty (the weakest guarantee). Missing data returns null,
 * which is reported as missing information - never as a poor score.
 */
@Service
public class DeliveryComparisonService {

    public Integer maxDeliveryDays(QuotationDetails quotation) {
        List<Integer> days = quotation.safeItems().stream().map(QuotationDetails.Item::deliveryDays).toList();
        if (days.isEmpty() || days.stream().anyMatch(Objects::isNull)) {
            return null;
        }
        return days.stream().max(Integer::compare).orElse(null);
    }

    public Integer minWarrantyMonths(QuotationDetails quotation) {
        List<Integer> months = quotation.safeItems().stream().map(QuotationDetails.Item::warrantyMonths).toList();
        if (months.isEmpty() || months.stream().anyMatch(Objects::isNull)) {
            return null;
        }
        return months.stream().min(Integer::compare).orElse(null);
    }
}
