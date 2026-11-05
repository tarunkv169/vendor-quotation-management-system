package com.vqms.service;

import com.vqms.dto.request.RecommendationCriteriaRequest;
import com.vqms.dto.response.RecommendationResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

public interface RecommendationService {

    RecommendationResponse generateRecommendation(UUID requestId, UUID userId);

    RecommendationResponse generateRecommendationWithCriteria(UUID requestId, UUID userId, RecommendationCriteriaRequest criteria);

    RecommendationResponse getLatestRecommendation(UUID requestId);

    Page<RecommendationResponse> getRecommendationsByRequestId(UUID requestId, Pageable pageable);

    void deleteRecommendation(UUID id, UUID userId);

    List<RecommendationResponse> getAllRecommendationsForRequest(UUID requestId);

    RecommendationResponse getRecommendationById(UUID id);
}
