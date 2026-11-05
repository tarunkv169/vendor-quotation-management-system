package com.vqms.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ProfileUpdateRequest {

    @Size(min = 3, max = 100, message = "Username must be between 3 and 100 characters")
    private String username;

    @Email(message = "Email must be valid")
    private String email;

    @Size(max = 150, message = "Full name cannot exceed 150 characters")
    private String fullName;

    @Size(min = 6, message = "Password must be at least 6 characters")
    private String newPassword;
}
