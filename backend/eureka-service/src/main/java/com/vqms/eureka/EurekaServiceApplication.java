package com.vqms.eureka;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.netflix.eureka.server.EnableEurekaServer;

/**
 * VQMS service registry. {@code @EnableEurekaServer} turns this app into the registry that services
 * register with when EUREKA_ENABLED=true. Keep it on the internal network only (no public exposure).
 */
@SpringBootApplication
@EnableEurekaServer
public class EurekaServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(EurekaServiceApplication.class, args);
    }
}
