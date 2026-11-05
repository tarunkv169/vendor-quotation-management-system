package com.vqms.service;

import com.vqms.dto.request.SystemSettingRequest;
import com.vqms.dto.response.SystemSettingResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface SystemSettingService {

    SystemSettingResponse getSettingByKey(String key);

    SystemSettingResponse createSetting(SystemSettingRequest request, UUID adminId);

    SystemSettingResponse updateSetting(String key, SystemSettingRequest request, UUID adminId);

    Page<SystemSettingResponse> getAllSettings(Pageable pageable);

    Page<SystemSettingResponse> getSettingsByCategory(String category, Pageable pageable);

    void deleteSetting(String key, UUID adminId);
}
