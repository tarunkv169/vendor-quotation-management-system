package com.vqms.controller;

import com.vqms.dto.request.SystemSettingRequest;
import com.vqms.dto.response.SystemSettingResponse;
import com.vqms.service.SystemSettingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/settings")
@RequiredArgsConstructor
public class SystemSettingController {

    private final SystemSettingService systemSettingService;

    @GetMapping("/{key}")
    public ResponseEntity<SystemSettingResponse> getSetting(@PathVariable String key) {
        return ResponseEntity.ok(systemSettingService.getSettingByKey(key));
    }

    @PostMapping
    public ResponseEntity<SystemSettingResponse> createSetting(
            @Valid @RequestBody SystemSettingRequest request) {
        SystemSettingResponse response = systemSettingService.createSetting(request, UUID.randomUUID());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{key}")
    public ResponseEntity<SystemSettingResponse> updateSetting(
            @PathVariable String key,
            @Valid @RequestBody SystemSettingRequest request) {
        return ResponseEntity.ok(systemSettingService.updateSetting(key, request, UUID.randomUUID()));
    }

    @GetMapping
    public ResponseEntity<Page<SystemSettingResponse>> getAllSettings(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(systemSettingService.getAllSettings(pageable));
    }

    @DeleteMapping("/{key}")
    public ResponseEntity<Void> deleteSetting(@PathVariable String key) {
        systemSettingService.deleteSetting(key, UUID.randomUUID());
        return ResponseEntity.noContent().build();
    }
}
