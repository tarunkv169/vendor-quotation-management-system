package com.vqms.audit;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Entry point of the Audit Service.
 * {@code @ConfigurationPropertiesScan} registers the typed *Properties records;
 * {@code @EnableScheduling} runs the transactional-outbox relay.
 */
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
public class AuditServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(AuditServiceApplication.class, args);
    }
}
