package com.vqms.document;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Entry point of the Document Service.
 *
 * <ul>
 *   <li>{@code @SpringBootApplication} turns on auto-configuration and component scanning
 *       for everything under {@code com.vqms.document}.</li>
 *   <li>{@code @ConfigurationPropertiesScan} registers the typed {@code *Properties} records
 *       in the config package, so settings are validated at startup.</li>
 *   <li>{@code @EnableScheduling} enables the stale-upload cleanup job.</li>
 * </ul>
 */
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
public class DocumentServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(DocumentServiceApplication.class, args);
    }
}
