package com.vqms.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SystemSettingRequest {

    @NotBlank(message = "Setting key is required")
    @Size(max = 100)
    private String settingKey;

    @NotBlank(message = "Setting value is required")
    private String settingValue;

    @Size(max = 50)
    private String settingType;

    @Size(max = 500)
    private String description;

    @Size(max = 50)
    private String category;
}
