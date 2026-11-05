package com.vqms.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * VQMS API Gateway: the only public entry point. It validates the JWT, adds a correlation id,
 * applies CORS for the frontend and routes /api/v1/** to the owning service.
 * Each service still validates the token and applies its own authorization (defence in depth).
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class GatewayServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(GatewayServiceApplication.class, args);
    }
}
