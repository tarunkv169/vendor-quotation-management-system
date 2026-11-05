package com.vqms.service;

import com.vqms.dto.request.LoginRequest;
import com.vqms.dto.request.ProfileUpdateRequest;
import com.vqms.dto.request.RegisterRequest;
import com.vqms.dto.response.AuthResponse;
import com.vqms.dto.response.UserResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface AuthService {

    AuthResponse login(LoginRequest request);

    AuthResponse register(RegisterRequest request);

    UserResponse getCurrentUser(UUID userId);

    UserResponse getUserById(UUID id);

    Page<UserResponse> getAllUsers(Pageable pageable);

    UserResponse updateUser(UUID id, RegisterRequest request, UUID adminId);

    void deactivateUser(UUID id, UUID adminId);

    UserResponse updateProfile(UUID userId, ProfileUpdateRequest request);
}
