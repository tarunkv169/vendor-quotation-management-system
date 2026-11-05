package com.vqms.notification;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Runs {@link NotificationRelay} on a schedule. */
@Configuration
@EnableScheduling
public class NotificationConfig {
}
