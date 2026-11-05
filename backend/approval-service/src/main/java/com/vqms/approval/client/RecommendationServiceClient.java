package com.vqms.approval.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vqms.approval.client.dto.RecommendationInfo;
import com.vqms.approval.exception.ApprovalNotFoundException;
import com.vqms.approval.exception.ExternalServiceUnavailableException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;
import java.util.UUID;

/** Loads a submitted recommendation and the authoritative total of its recommended quotation. */
@Component
public class RecommendationServiceClient {

    private static final String SERVICE = "Recommendation Service";

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public RecommendationServiceClient(RestClientFactory factory, ObjectMapper objectMapper,
                                       @Value("${services.recommendation.base-url}") String baseUrl) {
        this.restClient = factory.create(baseUrl);
        this.objectMapper = objectMapper;
    }

    public RecommendationInfo getRecommendation(UUID recommendationId) {
        try {
            JsonNode body = restClient.get().uri("/api/v1/recommendations/{id}", recommendationId)
                    .retrieve().body(JsonNode.class);
            JsonNode ranking = restClient.get().uri("/api/v1/recommendations/{id}/ranking", recommendationId)
                    .retrieve().body(JsonNode.class);
            if (body == null || ranking == null) {
                throw new ExternalServiceUnavailableException(SERVICE, new IllegalStateException("Empty response"));
            }
            BigDecimal total = null;
            for (JsonNode row : ranking) {
                if ("PRIMARY".equals(row.path("role").asText()) && row.hasNonNull("totalAmount")) {
                    total = new BigDecimal(row.get("totalAmount").asText());
                }
            }
            RecommendationInfo info = objectMapper.treeToValue(body, RecommendationInfo.class);
            return new RecommendationInfo(info.id(), info.recommendationNumber(), info.comparisonId(),
                    info.procurementRequestId(), info.status(), info.currencyCode(), info.recommendedQuotationId(),
                    info.recommendedVendorId(), info.riskLevel(), info.requiresReview(), info.reviewReasons(),
                    info.submittedBy(), total);
        } catch (HttpClientErrorException.NotFound ex) {
            throw new ApprovalNotFoundException("Recommendation not found: " + recommendationId);
        } catch (RestClientException | com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new ExternalServiceUnavailableException(SERVICE, ex);
        }
    }
}
