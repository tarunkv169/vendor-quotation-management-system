package com.vqms.document.config;

import com.vqms.document.constants.DocumentConstants;
import org.slf4j.MDC;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;

/**
 * One {@link RestClient} per downstream service.
 *
 * <ul>
 *   <li>Connect and read timeouts are always set, so a slow dependency cannot exhaust our threads.</li>
 *   <li>The caller's bearer token and the correlation id are forwarded, so downstream services
 *       authorize the same user and logs can be joined across services.</li>
 * </ul>
 * The injected {@link RestClient.Builder} is Spring Boot's pre-configured builder (Jackson etc.).
 */
@Configuration
public class RestClientConfig {

    @Bean
    public RestClient quotationRestClient(RestClient.Builder builder, ServiceClientProperties properties) {
        return build(builder, properties.quotation().baseUrl(), properties.http());
    }

    @Bean
    public RestClient vendorRestClient(RestClient.Builder builder, ServiceClientProperties properties) {
        return build(builder, properties.vendor().baseUrl(), properties.http());
    }

    private static RestClient build(RestClient.Builder builder, String baseUrl, ServiceClientProperties.Http http) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(http.connectTimeout())
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(http.readTimeout());

        return builder.clone()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .requestInterceptor(forwardingInterceptor())
                .build();
    }

    private static ClientHttpRequestInterceptor forwardingInterceptor() {
        return (request, body, execution) -> {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication instanceof JwtAuthenticationToken jwtAuthentication) {
                request.getHeaders().setBearerAuth(jwtAuthentication.getToken().getTokenValue());
            }
            String correlationId = MDC.get(DocumentConstants.CORRELATION_ID_MDC_KEY);
            if (correlationId != null && !request.getHeaders().containsKey(DocumentConstants.CORRELATION_ID_HEADER)) {
                request.getHeaders().add(DocumentConstants.CORRELATION_ID_HEADER, correlationId);
            }
            request.getHeaders().remove(HttpHeaders.COOKIE);
            return execution.execute(request, body);
        };
    }
}
