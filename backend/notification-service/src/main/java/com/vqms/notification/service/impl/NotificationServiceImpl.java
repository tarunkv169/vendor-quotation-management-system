package com.vqms.notification.service.impl;

import com.vqms.notification.dto.request.NotificationRequest;
import com.vqms.notification.dto.response.NotificationResponse;
import com.vqms.notification.dto.response.PageResponse;
import com.vqms.notification.entity.Notification;
import com.vqms.notification.entity.NotificationRead;
import com.vqms.notification.exception.InvalidNotificationException;
import com.vqms.notification.exception.NotificationNotFoundException;
import com.vqms.notification.repository.NotificationReadRepository;
import com.vqms.notification.repository.NotificationRepository;
import com.vqms.notification.security.AuthenticatedUser;
import com.vqms.notification.security.CurrentUserProvider;
import com.vqms.notification.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class NotificationServiceImpl implements NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationServiceImpl.class);

    private final NotificationRepository repository;
    private final NotificationReadRepository readRepository;
    private final CurrentUserProvider currentUserProvider;
    private final TransactionTemplate transactionTemplate;

    public NotificationServiceImpl(NotificationRepository repository, NotificationReadRepository readRepository,
                                   CurrentUserProvider currentUserProvider, TransactionTemplate transactionTemplate) {
        this.repository = repository;
        this.readRepository = readRepository;
        this.currentUserProvider = currentUserProvider;
        this.transactionTemplate = transactionTemplate;
    }

    @Override
    public NotificationResponse send(NotificationRequest request) {
        AuthenticatedUser user = currentUserProvider.getCurrentUser();
        return toResponse(create(request, user.userId()), false);
    }

    @Override
    public void sendSystem(NotificationRequest request) {
        create(request, null);
    }

    private Notification create(NotificationRequest r, UUID createdBy) {
        if ((r.recipientUserId() == null) == (r.recipientRole() == null || r.recipientRole().isBlank())) {
            throw new InvalidNotificationException("Exactly one of recipientUserId or recipientRole is required");
        }
        if (r.dedupeKey() != null) {
            var existing = repository.findByDedupeKey(r.dedupeKey());
            if (existing.isPresent()) {
                return existing.get();
            }
        }
        Notification notification = Notification.builder()
                .recipientUserId(r.recipientUserId())
                .recipientRole(r.recipientRole() == null ? null : r.recipientRole().trim().toUpperCase(Locale.ROOT))
                .category(r.category()).priority(r.priority()).title(r.title()).message(r.message())
                .referenceType(r.referenceType()).referenceId(r.referenceId()).dedupeKey(r.dedupeKey())
                .sendEmail(r.sendEmail()).createdBy(createdBy)
                .build();
        try {
            return transactionTemplate.execute(status -> repository.saveAndFlush(notification));
        } catch (DataIntegrityViolationException ex) {
            // Concurrent duplicate with the same dedupe key.
            return repository.findByDedupeKey(r.dedupeKey()).orElseThrow(() -> ex);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<NotificationResponse> myNotifications(boolean unreadOnly, Pageable pageable) {
        AuthenticatedUser user = currentUserProvider.getCurrentUser();
        Pageable sorted = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Notification> page = unreadOnly
                ? repository.findUnread(user.userId(), user.role(), sorted)
                : repository.findVisible(user.userId(), user.role(), sorted);
        Set<UUID> readIds = unreadOnly ? Set.of() : readRepository
                .findByUserIdAndNotificationIdIn(user.userId(), page.getContent().stream().map(Notification::getId).toList())
                .stream().map(NotificationRead::getNotificationId).collect(Collectors.toSet());
        return PageResponse.from(page, n -> toResponse(n, readIds.contains(n.getId())));
    }

    @Override
    @Transactional(readOnly = true)
    public long unreadCount() {
        AuthenticatedUser user = currentUserProvider.getCurrentUser();
        return repository.countUnread(user.userId(), user.role());
    }

    @Override
    @Transactional(readOnly = true)
    public NotificationResponse get(UUID id) {
        AuthenticatedUser user = currentUserProvider.getCurrentUser();
        Notification n = visible(id, user);
        return toResponse(n, readRepository.existsByNotificationIdAndUserId(id, user.userId()));
    }

    @Override
    @Transactional
    public NotificationResponse markRead(UUID id) {
        AuthenticatedUser user = currentUserProvider.getCurrentUser();
        Notification n = visible(id, user);
        if (!readRepository.existsByNotificationIdAndUserId(id, user.userId())) {
            readRepository.save(new NotificationRead(id, user.userId()));
        }
        return toResponse(n, true);
    }

    @Override
    @Transactional
    public int markAllRead() {
        AuthenticatedUser user = currentUserProvider.getCurrentUser();
        List<UUID> unread = repository.findUnreadIds(user.userId(), user.role());
        unread.forEach(id -> readRepository.save(new NotificationRead(id, user.userId())));
        log.info("User {} marked {} notification(s) read", user.userId(), unread.size());
        return unread.size();
    }

    private Notification visible(UUID id, AuthenticatedUser user) {
        return repository.findById(id)
                .filter(n -> n.isVisibleTo(user.userId(), user.role()))
                .orElseThrow(() -> new NotificationNotFoundException(id));
    }

    private static NotificationResponse toResponse(Notification n, boolean read) {
        return new NotificationResponse(n.getId(), n.getRecipientUserId(), n.getRecipientRole(), n.getCategory(),
                n.getPriority(), n.getTitle(), n.getMessage(), n.getReferenceType(), n.getReferenceId(), read,
                n.getEmailStatus(), n.getCreatedAt());
    }
}
