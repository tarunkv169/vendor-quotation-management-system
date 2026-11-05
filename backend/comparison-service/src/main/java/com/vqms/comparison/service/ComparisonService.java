package com.vqms.comparison.service;

import com.vqms.comparison.dto.request.ComparisonRequest;
import com.vqms.comparison.dto.response.ComparisonResponse;
import com.vqms.comparison.dto.response.ComparisonResultResponse;
import com.vqms.comparison.dto.response.PageResponse;
import com.vqms.comparison.dto.response.VendorComparisonResponse;
import com.vqms.comparison.enums.ComparisonStatus;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

/** Comparison use cases. */
public interface ComparisonService {

    ComparisonResponse create(ComparisonRequest request);

    ComparisonResultResponse calculate(UUID comparisonId);

    ComparisonResponse complete(UUID comparisonId);

    ComparisonResponse getById(UUID comparisonId);

    PageResponse<ComparisonResponse> search(ComparisonStatus status, UUID procurementRequestId, Pageable pageable);

    ComparisonResultResponse getResults(UUID comparisonId);

    List<VendorComparisonResponse> getRanking(UUID comparisonId);
}
