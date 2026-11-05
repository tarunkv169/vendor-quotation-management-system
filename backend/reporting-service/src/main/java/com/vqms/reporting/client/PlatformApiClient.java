package com.vqms.reporting.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.vqms.reporting.config.ReportingProperties;
import com.vqms.reporting.constants.ReportingConstants;
import com.vqms.reporting.exception.ExternalServiceUnavailableException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriBuilder;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

/**
 * Read-only access to the authoritative services. One class instead of five near-identical clients:
 * every call is a GET returning JSON, and paging follows the shared PageResponse/Spring Page shape
 * ({@code content}, {@code last}). The caller's JWT is forwarded, so downstream access rules apply.
 */
@Component
public class PlatformApiClient {

    public enum Source { QUOTATION, VALIDATION, COMPARISON, RECOMMENDATION, APPROVAL }

    private final Map<Source, RestClient> clients;
    private final int maxRows;

    public PlatformApiClient(RestClientFactory factory, ReportingProperties properties,
                             @Value("${services.quotation.base-url}") String quotation,
                             @Value("${services.validation.base-url}") String validation,
                             @Value("${services.comparison.base-url}") String comparison,
                             @Value("${services.recommendation.base-url}") String recommendation,
                             @Value("${services.approval.base-url}") String approval) {
        this.clients = Map.of(
                Source.QUOTATION, factory.create(quotation),
                Source.VALIDATION, factory.create(validation),
                Source.COMPARISON, factory.create(comparison),
                Source.RECOMMENDATION, factory.create(recommendation),
                Source.APPROVAL, factory.create(approval));
        this.maxRows = properties.maxSourceRows();
    }

    /** Single JSON resource; empty on 404. */
    public Optional<JsonNode> get(Source source, Function<UriBuilder, URI> uri) {
        try {
            return Optional.ofNullable(clients.get(source).get().uri(uri).retrieve().body(JsonNode.class));
        } catch (HttpClientErrorException.NotFound ex) {
            return Optional.empty();
        } catch (RestClientException ex) {
            throw new ExternalServiceUnavailableException(source.name() + " service", ex);
        }
    }

    /** Reads all pages of a paged endpoint (capped at maxSourceRows). */
    public List<JsonNode> getAll(Source source, String path, Map<String, Object> query, Object... pathVariables) {
        List<JsonNode> rows = new ArrayList<>();
        for (int page = 0; rows.size() < maxRows; page++) {
            final int current = page;
            Optional<JsonNode> body = get(source, b -> {
                UriBuilder builder = b.path(path).queryParam("page", current)
                        .queryParam("size", ReportingConstants.PAGE_SIZE);
                query.forEach(builder::queryParam);
                return builder.build(pathVariables);
            });
            if (body.isEmpty() || !body.get().has("content")) {
                break;
            }
            body.get().get("content").forEach(rows::add);
            if (body.get().path("last").asBoolean(true) || body.get().get("content").isEmpty()) {
                break;
            }
        }
        return rows.size() > maxRows ? rows.subList(0, maxRows) : rows;
    }
}
