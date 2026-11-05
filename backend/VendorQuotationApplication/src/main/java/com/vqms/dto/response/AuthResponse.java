package com.vqms.dto.response;

import lombok.Data;

import java.util.UUID;

@Data
public class AuthResponse {

    private String token;
    private String type = "Bearer";
    private UUID userId;
    private String username;
    private String role;
}
