package com.vqms.notification.service.internal;

import com.vqms.notification.client.IdentityServiceClient;
import com.vqms.notification.config.NotificationProperties;
import com.vqms.notification.entity.Notification;
import com.vqms.notification.enums.EmailStatus;
import com.vqms.notification.repository.NotificationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.Limit;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Sends pending e-mails in the background (never inside the API request), with bounded retries.
 * Does nothing while {@code vqms.notification.email.enabled=false}; PENDING notifications are then
 * kept and delivered once email is enabled.
 */
@Service
public class EmailDeliveryService {

    private static final Logger log = LoggerFactory.getLogger(EmailDeliveryService.class);
    private static final int BATCH = 50;

    private final NotificationRepository repository;
    private final IdentityServiceClient identityClient;
    private final ObjectProvider<JavaMailSender> mailSender;
    private final NotificationProperties properties;

    public EmailDeliveryService(NotificationRepository repository, IdentityServiceClient identityClient,
                                ObjectProvider<JavaMailSender> mailSender, NotificationProperties properties) {
        this.repository = repository;
        this.identityClient = identityClient;
        this.mailSender = mailSender;
        this.properties = properties;
    }

    @Scheduled(fixedDelayString = "${vqms.notification.email.retry-interval:PT5M}", initialDelayString = "PT30S")
    @Transactional
    public void deliverPending() {
        JavaMailSender sender = mailSender.getIfAvailable();
        if (!properties.email().enabled() || sender == null) {
            return;
        }
        List<Notification> pending = repository.findByEmailStatusOrderByCreatedAtAsc(EmailStatus.PENDING, Limit.of(BATCH));
        for (Notification n : pending) {
            try {
                String to = identityClient.findUser(n.getRecipientUserId())
                        .map(IdentityServiceClient.UserContact::email)
                        .filter(email -> email != null && email.contains("@"))
                        .orElseThrow(() -> new IllegalStateException("Recipient has no e-mail address"));
                SimpleMailMessage mail = new SimpleMailMessage();
                mail.setFrom(properties.email().from());
                mail.setTo(to);
                mail.setSubject("[VQMS] " + n.getTitle());
                mail.setText(n.getMessage());
                sender.send(mail);
                n.emailSent();
            } catch (MailException | IllegalStateException | com.vqms.notification.exception.ExternalServiceUnavailableException ex) {
                n.emailFailed(ex.getMessage(), properties.email().maxAttempts());
                log.warn("E-mail for notification {} failed (attempt {}): {}", n.getId(), n.getEmailAttempts(),
                        ex.getMessage());
            }
        }
    }
}
