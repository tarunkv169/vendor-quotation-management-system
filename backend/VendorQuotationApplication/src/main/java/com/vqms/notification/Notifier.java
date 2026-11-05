package com.vqms.notification;

import com.vqms.entity.User;
import com.vqms.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Queues notifications inside the caller's transaction. Recipients are resolved here (users by id
 * and/or every active user holding one of the roles); the person who triggered the event is skipped.
 */
@Component
@RequiredArgsConstructor
public class Notifier {

    public static final String PROCUREMENT_REQUEST = "PROCUREMENT_REQUEST";
    public static final String QUOTATION = "QUOTATION";

    private final NotificationOutboxRepository outbox;
    private final UserRepository users;

    @Transactional(propagation = Propagation.MANDATORY)
    public void notify(Recipients recipients, NotificationType type, String title, String message,
                       String referenceType, UUID referenceId) {
        Set<UUID> ids = new LinkedHashSet<>();
        recipients.userIds.stream().filter(Objects::nonNull).forEach(ids::add);
        if (!recipients.roles.isEmpty()) {
            users.findByRoleInAndStatus(recipients.roles, "ACTIVE").stream().map(User::getId).forEach(ids::add);
        }
        if (recipients.actorId != null) {
            ids.remove(recipients.actorId);
        }
        ids.forEach(id -> outbox.save(new NotificationOutbox(id, type, title, message, referenceType, referenceId)));
    }

    /** Who receives a notification. */
    public static final class Recipients {
        private final Set<UUID> userIds = new LinkedHashSet<>();
        private final Set<String> roles = new LinkedHashSet<>();
        private UUID actorId;

        public static Recipients users(UUID... ids) {
            Recipients recipients = new Recipients();
            recipients.userIds.addAll(Arrays.asList(ids));
            return recipients;
        }

        public static Recipients roles(String... roles) {
            return new Recipients().andRoles(roles);
        }

        public Recipients andRoles(String... roles) {
            this.roles.addAll(Arrays.asList(roles));
            return this;
        }

        public Recipients andUser(UUID id) {
            this.userIds.add(id);
            return this;
        }

        /** The user who caused the event; never notified about their own action. */
        public Recipients except(UUID actorId) {
            this.actorId = actorId;
            return this;
        }
    }
}
