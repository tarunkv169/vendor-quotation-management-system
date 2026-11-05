package com.vqms.recommendation.service;

import com.vqms.recommendation.dto.request.RecommendationRequest;
import com.vqms.recommendation.dto.request.SubmitForApprovalRequest;
import com.vqms.recommendation.dto.response.PageResponse;
import com.vqms.recommendation.dto.response.RecommendationExplanationResponse;
import com.vqms.recommendation.dto.response.RecommendationResponse;
import com.vqms.recommendation.dto.response.RecommendedVendorResponse;
import com.vqms.recommendation.enums.RecommendationStatus;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

/** Recommendation use cases. None of them approves or rejects a quotation. */
public interface RecommendationService {

    RecommendationResponse generate(RecommendationRequest request);

    RecommendationResponse regenerate(UUID recommendationId);

    RecommendationResponse submitForApproval(UUID recommendationId, SubmitForApprovalRequest request);

    RecommendationResponse getById(UUID recommendationId);

    PageResponse<RecommendationResponse> search(RecommendationStatus status, UUID procurementRequestId,
                                                Pageable pageable);

    List<RecommendedVendorResponse> getRanking(UUID recommendationId);

    RecommendationExplanationResponse getExplanation(UUID recommendationId);
}
