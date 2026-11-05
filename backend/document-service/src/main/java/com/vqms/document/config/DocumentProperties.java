package com.vqms.document.config;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;
import java.util.Set;

/**
 * Document rules bound from {@code vqms.document.*}.
 *
 * <p>{@code @ConfigurationProperties} maps properties to this record;
 * {@code @Validated} makes the application fail at startup when a value is missing or invalid.</p>
 *
 * @param maxFileSize        hard per-file size limit enforced by the service
 * @param allowedExtensions  global allow-list of file extensions (lower case)
 * @param purgeFileOnDelete  when true, the S3 object is removed after a soft delete commits
 * @param staleUploadTimeout uploads stuck in UPLOADING longer than this are marked UPLOAD_FAILED
 */
@Validated
@ConfigurationProperties(prefix = "vqms.document")
public record DocumentProperties(
        @NotNull DataSize maxFileSize,
        @NotEmpty Set<String> allowedExtensions,
        boolean purgeFileOnDelete,
        @NotNull Duration staleUploadTimeout
) {
}
