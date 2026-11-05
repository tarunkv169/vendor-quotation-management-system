package com.vqms.comparison;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Entry point of the Comparison Service.
 * {@code @ConfigurationPropertiesScan} registers the typed *Properties records;
 * {@code @EnableScheduling} runs the transactional-outbox relay.
 */
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
public class ComparisonServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(ComparisonServiceApplication.class, args);
    }
}
