package com.vqms.service.impl;

import com.vqms.dto.request.SystemSettingRequest;
import com.vqms.dto.response.SystemSettingResponse;
import com.vqms.entity.SystemSetting;
import com.vqms.exception.BadRequestException;
import com.vqms.repository.SystemSettingRepository;
import com.vqms.service.SystemSettingService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class SystemSettingServiceImpl implements SystemSettingService {

    private final SystemSettingRepository systemSettingRepository;

    @Override
    @Transactional(readOnly = true)
    public SystemSettingResponse getSettingByKey(String key) {
        SystemSetting setting = systemSettingRepository.findBySettingKey(key)
                .orElseThrow(() -> new EntityNotFoundException("Setting not found: " + key));
        return toResponse(setting);
    }

    @Override
    public SystemSettingResponse createSetting(SystemSettingRequest request, UUID adminId) {
        if (systemSettingRepository.existsBySettingKey(request.getSettingKey())) {
            throw new BadRequestException("Setting key already exists: " + request.getSettingKey());
        }
        SystemSetting setting = new SystemSetting();
        setting.setSettingKey(request.getSettingKey());
        setting.setSettingValue(request.getSettingValue());
        setting.setSettingType(request.getSettingType());
        setting.setDescription(request.getDescription());
        setting.setCategory(request.getCategory());
        setting.setCreatedBy(adminId);
        SystemSetting saved = systemSettingRepository.save(setting);
        return toResponse(saved);
    }

    @Override
    public SystemSettingResponse updateSetting(String key, SystemSettingRequest request, UUID adminId) {
        SystemSetting setting = systemSettingRepository.findBySettingKey(key)
                .orElseThrow(() -> new EntityNotFoundException("Setting not found: " + key));
        setting.setSettingValue(request.getSettingValue());
        if (request.getSettingType() != null) setting.setSettingType(request.getSettingType());
        if (request.getDescription() != null) setting.setDescription(request.getDescription());
        if (request.getCategory() != null) setting.setCategory(request.getCategory());
        SystemSetting saved = systemSettingRepository.save(setting);
        return toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<SystemSettingResponse> getAllSettings(Pageable pageable) {
        return systemSettingRepository.findAll(pageable).map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<SystemSettingResponse> getSettingsByCategory(String category, Pageable pageable) {
        Page<SystemSettingResponse> all = getAllSettings(pageable);
        List<SystemSettingResponse> filtered = all.getContent().stream()
                .filter(s -> category == null || category.equals(s.getCategory()))
                .toList();
        return new org.springframework.data.domain.PageImpl<>(filtered, pageable, filtered.size());
    }

    @Override
    public void deleteSetting(String key, UUID adminId) {
        SystemSetting setting = systemSettingRepository.findBySettingKey(key)
                .orElseThrow(() -> new EntityNotFoundException("Setting not found: " + key));
        systemSettingRepository.delete(setting);
    }

    private SystemSettingResponse toResponse(SystemSetting setting) {
        SystemSettingResponse response = new SystemSettingResponse();
        response.setId(setting.getId());
        response.setSettingKey(setting.getSettingKey());
        response.setSettingValue(setting.getSettingValue());
        response.setSettingType(setting.getSettingType());
        response.setDescription(setting.getDescription());
        response.setCategory(setting.getCategory());
        response.setCreatedAt(setting.getCreatedAt());
        response.setUpdatedAt(setting.getUpdatedAt());
        return response;
    }
}
