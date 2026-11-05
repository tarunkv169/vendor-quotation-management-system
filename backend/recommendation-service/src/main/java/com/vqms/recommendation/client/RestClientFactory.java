package com.vqms.recommendation.client;

import com.vqms.recommendation.config.CorrelationIdFilter;
import com.vqms.recommendation.config.HttpClientProperties;
import com.vqms.recommendation.security.ServiceTokenProvider;
import org.slf4j.MDC;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;

/**
 * Builds RestClients with timeouts and authentication:
 * the caller's JWT is forwarded during a user request; otherwise (scheduled jobs,
 * background tasks) a short-lived INTERNAL_SERVICE token is used. The correlation id is propagated.
 */
@Component
public class RestClientFactory {

    private final RestClient.Builder builder;
    private final HttpClientProperties properties;
    private final ServiceTokenProvider serviceTokenProvider;

    public RestClientFactory(RestClient.Builder builder, HttpClientProperties properties,
                             ServiceTokenProvider serviceTokenProvider) {
        this.builder = builder;
        this.properties = properties;
        this.serviceTokenProvider = serviceTokenProvider;
    }

    public RestClient create(String baseUrl) {
        HttpClient httpClient = HttpClient.newBuilder().connectTimeout(properties.connectTimeout()).build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(properties.readTimeout());
        return builder.clone()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .requestInterceptor(authInterceptor())
                .build();
    }

    private ClientHttpRequestInterceptor authInterceptor() {
        return (request, body, execution) -> {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            String token = authentication instanceof JwtAuthenticationToken jwt
                    ? jwt.getToken().getTokenValue()
                    : serviceTokenProvider.getToken();
            request.getHeaders().setBearerAuth(token);
            String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
            if (correlationId != null) {
                request.getHeaders().set(CorrelationIdFilter.HEADER, correlationId);
            }
            return execution.execute(request, body);
        };
    }
}
