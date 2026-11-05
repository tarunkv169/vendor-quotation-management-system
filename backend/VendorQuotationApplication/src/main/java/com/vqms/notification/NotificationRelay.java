package com.vqms.notification;

import com.vqms.util.JwtUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Delivers queued notifications to the Notification Service (POST /api/v1/notifications) with a
 * short-lived INTERNAL_SERVICE token. Failed deliveries are retried with back-off; the outbox row id
 * is sent as the dedupe key, so a retry after a lost response never creates a duplicate.
 */
@Component
public class NotificationRelay {

    private static final Logger log = LoggerFactory.getLogger(NotificationRelay.class);

    private final NotificationOutboxRepository outbox;
    private final JwtUtil jwtUtil;
    private final RestClient client;
    private final boolean enabled;
    private final int maxAttempts;

    public NotificationRelay(NotificationOutboxRepository outbox, JwtUtil jwtUtil,
                             @Value("${vqms.notifications.base-url}") String baseUrl,
                             @Value("${vqms.notifications.enabled:true}") boolean enabled,
                             @Value("${vqms.notifications.max-attempts:8}") int maxAttempts) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(3_000);
        requestFactory.setReadTimeout(5_000);
        this.outbox = outbox;
        this.jwtUtil = jwtUtil;
        this.client = RestClient.builder().baseUrl(baseUrl).requestFactory(requestFactory).build();
        this.enabled = enabled;
        this.maxAttempts = maxAttempts;
    }

    @Scheduled(initialDelayString = "PT20S", fixedDelayString = "${vqms.notifications.relay-interval:PT3S}")
    @Transactional
    public void relay() {
        if (!enabled) {
            return;
        }
        List<NotificationOutbox> due = outbox.lockDue(maxAttempts, 25);
        if (due.isEmpty()) {
            return;
        }
        String token = jwtUtil.generateServiceToken();
        for (NotificationOutbox n : due) {
            try {
                client.post().uri("/api/v1/notifications")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + token)
                        .body(body(n))
                        .retrieve()
                        .toBodilessEntity();
                n.markSent();
            } catch (RestClientException ex) {
                n.markFailed(ex.getMessage());
                if (n.getAttempts() >= maxAttempts) {
                    log.error("Notification {} for user {} dropped after {} attempts: {}",
                            n.getId(), n.getRecipientUserId(), n.getAttempts(), ex.getMessage());
                } else {
                    log.warn("Notification {} not delivered (attempt {}), next try at {}: {}",
                            n.getId(), n.getAttempts(), n.getNextAttemptAt(), ex.getMessage());
                }
                // The service is probably down: stop this batch, the rest is retried next round.
                break;
            }
        }
    }

    private static Map<String, Object> body(NotificationOutbox n) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("recipientUserId", n.getRecipientUserId());
        body.put("category", n.getCategory());
        body.put("priority", n.getPriority());
        body.put("title", n.getTitle());
        body.put("message", n.getMessage());
        body.put("referenceType", n.getReferenceType());
        body.put("referenceId", n.getReferenceId());
        body.put("dedupeKey", "monolith:" + n.getId());
        body.put("sendEmail", false);
        return body;
    }
}
