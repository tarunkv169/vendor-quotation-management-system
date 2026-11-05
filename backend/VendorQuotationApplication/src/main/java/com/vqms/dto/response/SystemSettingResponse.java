package com.vqms.dto.response;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class SystemSettingResponse {

    private UUID id;
    private String settingKey;
    private String settingValue;
    private String settingType;
    private String description;
    private String category;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
