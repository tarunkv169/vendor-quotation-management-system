package com.vqms.approval.event;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vqms.approval.client.RestClientFactory;
import com.vqms.approval.constants.ApprovalConstants;
import com.vqms.approval.entity.Approval;
import com.vqms.approval.entity.OutboxEvent;
import com.vqms.approval.repository.ApprovalRepository;
import com.vqms.approval.repository.OutboxEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Relays committed approval events from the transactional outbox to the Notification Service
 * (POST /api/v1/notifications, INTERNAL_SERVICE token). Approvers are addressed by role, the
 * requester and the submitter by user id. Each notification carries "eventId:target" as dedupe key,
 * so re-sending an event after a failure never creates duplicates. Failed events stay unpublished
 * and are retried on the next run (up to {@code max-attempts}).
 */
@Component
@ConditionalOnProperty(name = "vqms.notifications.relay.enabled", havingValue = "true", matchIfMissing = true)
public class NotificationOutboxRelay {

    private static final Logger log = LoggerFactory.getLogger(NotificationOutboxRelay.class);
    private static final DateTimeFormatter DUE = DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm").withZone(ZoneId.of("UTC"));

    private final OutboxEventRepository outboxRepository;
    private final ApprovalRepository approvalRepository;
    private final ObjectMapper objectMapper;
    private final RestClient client;
    private final int maxAttempts;
    /** Back-off after a failed delivery: 10s, 20s, 40s ... up to 5 minutes. */
    private int consecutiveFailures;
    private Instant pausedUntil = Instant.EPOCH;

    public NotificationOutboxRelay(OutboxEventRepository outboxRepository, ApprovalRepository approvalRepository,
                                   ObjectMapper objectMapper, RestClientFactory restClientFactory,
                                   @Value("${services.notification.base-url}") String baseUrl,
                                   @Value("${vqms.notifications.relay.max-attempts:20}") int maxAttempts) {
        this.outboxRepository = outboxRepository;
        this.approvalRepository = approvalRepository;
        this.objectMapper = objectMapper;
        this.client = restClientFactory.create(baseUrl);
        this.maxAttempts = maxAttempts;
    }

    @Scheduled(initialDelayString = "PT20S", fixedDelayString = "${vqms.notifications.relay.interval:PT3S}")
    @Transactional
    public void relay() {
        if (Instant.now().isBefore(pausedUntil)) {
            return;
        }
        for (OutboxEvent event : outboxRepository.lockUnpublished(25)) {
            if (event.getAttempts() >= maxAttempts) {
                continue;
            }
            try {
                for (Map<String, Object> notification : toNotifications(event)) {
                    client.post().uri("/api/v1/notifications").contentType(MediaType.APPLICATION_JSON)
                            .body(notification).retrieve().toBodilessEntity();
                }
                event.markPublished();
                consecutiveFailures = 0;
            } catch (Exception ex) {
                event.markFailed(ex.getMessage());
                consecutiveFailures++;
                pausedUntil = Instant.now().plusSeconds(Math.min(300, 10L << Math.min(consecutiveFailures - 1, 5)));
                log.warn("Approval event {} ({}) not delivered, attempt {}: {}",
                        event.getId(), event.getEventType(), event.getAttempts(), ex.getMessage());
                break; // the Notification Service is probably down; retry the rest next run
            }
        }
    }

    private List<Map<String, Object>> toNotifications(OutboxEvent event) throws Exception {
        JsonNode e = objectMapper.readTree(event.getPayload());
        Approval approval = approvalRepository.findById(event.getAggregateId()).orElse(null);
        String number = e.path("approvalNumber").asText("Approval");
        UUID approvalId = event.getAggregateId();
        List<Map<String, Object>> out = new ArrayList<>();

        switch (event.getEventType()) {
            case ApprovalConstants.EVENT_APPROVAL_CREATED -> {
                String amount = amount(e.path("amount"), e.path("currencyCode").asText(null));
                for (JsonNode level : e.path("pendingLevels")) {
                    out.add(toRole(event, level.path("requiredRole").asText(), "APPROVAL_REQUIRED", "HIGH",
                            "Approval needed: " + number,
                            "A recommended quotation" + amount + " is waiting for your decision (level "
                                    + level.path("levelNumber").asInt() + ")." + due(level.path("dueAt")),
                            approvalId));
                }
            }
            case ApprovalEventPublisher.EVENT_STEP_ACTIVATED -> out.add(toRole(event, e.path("requiredRole").asText(),
                    "APPROVAL_REQUIRED", "HIGH", "Approval needed: " + number,
                    "Level " + e.path("levelNumber").asInt() + " of " + number + " is now waiting for your decision."
                            + due(e.path("dueAt")),
                    approvalId));
            case ApprovalConstants.EVENT_APPROVAL_ESCALATED -> out.add(toRole(event, e.path("escalationRole").asText(),
                    "APPROVAL_ESCALATED", "HIGH", "Escalated: " + number,
                    "Level " + e.path("levelNumber").asInt() + " of " + number + " missed its deadline and was escalated to you."
                            + due(e.path("newDueAt")),
                    approvalId));
            case ApprovalConstants.EVENT_APPROVAL_COMPLETED -> {
                String amount = amount(e.path("amount"), e.path("currencyCode").asText(null));
                for (UUID user : participants(approval, null)) {
                    out.add(toUser(event, user, "APPROVAL_COMPLETED", "NORMAL", "Approved: " + number,
                            number + amount + " was approved at every level. The recommended quotation can now be awarded.",
                            approvalId));
                }
            }
            case ApprovalConstants.EVENT_APPROVAL_REJECTED -> {
                boolean cancelled = e.path("cancelled").asBoolean(false);
                String comment = e.path("comment").asText("");
                UUID decidedBy = uuid(e.path("decidedBy"));
                for (UUID user : participants(approval, decidedBy)) {
                    out.add(toUser(event, user, "APPROVAL_REJECTED", "HIGH",
                            (cancelled ? "Cancelled: " : "Rejected: ") + number,
                            number + (cancelled ? " was cancelled." : " was rejected.")
                                    + (comment.isBlank() ? "" : " Comment: " + comment),
                            approvalId));
                }
            }
            default -> {
                // Other event types do not notify anyone.
            }
        }
        return out;
    }

    /** Requester and submitter of the approval, without the person who made the decision. */
    private static Set<UUID> participants(Approval approval, UUID exclude) {
        Set<UUID> users = new LinkedHashSet<>();
        if (approval != null) {
            users.add(approval.getRequesterId());
            users.add(approval.getSubmittedBy());
        }
        users.remove(null);
        if (exclude != null) {
            users.remove(exclude);
        }
        return users;
    }

    private static Map<String, Object> toRole(OutboxEvent event, String role, String category, String priority,
                                              String title, String message, UUID referenceId) {
        Map<String, Object> body = base(category, priority, title, message, referenceId);
        body.put("recipientRole", role);
        body.put("dedupeKey", "approval:" + event.getId() + ":" + role);
        return body;
    }

    private static Map<String, Object> toUser(OutboxEvent event, UUID user, String category, String priority,
                                              String title, String message, UUID referenceId) {
        Map<String, Object> body = base(category, priority, title, message, referenceId);
        body.put("recipientUserId", user);
        body.put("dedupeKey", "approval:" + event.getId() + ":" + user);
        return body;
    }

    private static Map<String, Object> base(String category, String priority, String title, String message,
                                            UUID referenceId) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("category", category);
        body.put("priority", priority);
        body.put("title", title.length() > 200 ? title.substring(0, 200) : title);
        body.put("message", message.length() > 2000 ? message.substring(0, 2000) : message);
        body.put("referenceType", "APPROVAL");
        body.put("referenceId", referenceId);
        body.put("sendEmail", false);
        return body;
    }

    private static String amount(JsonNode value, String currency) {
        if (value == null || value.isMissingNode() || value.isNull()) {
            return "";
        }
        NumberFormat format = NumberFormat.getNumberInstance(Locale.ENGLISH);
        format.setMinimumFractionDigits(2);
        format.setMaximumFractionDigits(2);
        return " of " + Objects.requireNonNullElse(currency, "") + " " + format.format(new BigDecimal(value.asText()));
    }

    private static String due(JsonNode value) {
        if (value == null || value.isMissingNode() || value.isNull() || value.asText().isBlank()) {
            return "";
        }
        try {
            return " Due " + DUE.format(Instant.parse(value.asText())) + " UTC.";
        } catch (Exception ex) {
            return "";
        }
    }

    private static UUID uuid(JsonNode value) {
        try {
            return value == null || value.isNull() || value.asText().isBlank() ? null : UUID.fromString(value.asText());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
