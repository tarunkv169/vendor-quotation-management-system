package com.vqms.document.config;

import com.vqms.document.constants.DocumentConstants;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Reads (or creates) the {@code X-Correlation-Id} header, stores it in the logging MDC
 * and echoes it in the response.
 * {@code @Order(HIGHEST_PRECEDENCE)} runs it before Spring Security so even 401 responses
 * carry the id. Untrusted header values are validated to prevent log injection.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {

    private static final Pattern SAFE_ID = Pattern.compile("^[A-Za-z0-9-]{1,64}$");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String incoming = request.getHeader(DocumentConstants.CORRELATION_ID_HEADER);
        String correlationId = (incoming != null && SAFE_ID.matcher(incoming).matches())
                ? incoming
                : UUID.randomUUID().toString();

        MDC.put(DocumentConstants.CORRELATION_ID_MDC_KEY, correlationId);
        response.setHeader(DocumentConstants.CORRELATION_ID_HEADER, correlationId);
        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove(DocumentConstants.CORRELATION_ID_MDC_KEY);
        }
    }
}
