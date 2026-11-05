package com.vqms.service;

import com.vqms.dto.response.ComparisonResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface ComparisonService {

    ComparisonResponse generateComparison(UUID requestId, UUID userId);

    ComparisonResponse getComparisonById(UUID id);

    Page<ComparisonResponse> getComparisonsByRequestId(UUID requestId, Pageable pageable);

    void deleteComparison(UUID id, UUID userId);

    Map<String, Object> getPriceVariance(UUID requestId);

    Map<String, Object> getDeliveryComparison(UUID requestId);

    List<Map<String, Object>> getMissingFieldsReport(UUID requestId);

    List<ComparisonResponse> getAllComparisonsForRequest(UUID requestId);
}
