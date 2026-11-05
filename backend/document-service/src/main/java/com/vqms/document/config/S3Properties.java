package com.vqms.document.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

/**
 * S3 settings bound from {@code vqms.storage.s3.*}.
 * Credentials are intentionally absent: the AWS SDK resolves them from the
 * default provider chain (IAM role, environment variables, profile).
 *
 * @param endpoint             optional endpoint override (LocalStack / MinIO); empty for AWS
 * @param pathStyleAccess      required by LocalStack/MinIO, false for AWS
 * @param presignedUrlDuration lifetime of download URLs; keep this short
 */
@Validated
@ConfigurationProperties(prefix = "vqms.storage.s3")
public record S3Properties(
        @NotBlank String bucket,
        @NotBlank String region,
        String endpoint,
        boolean pathStyleAccess,
        @NotBlank String keyPrefix,
        @NotNull Duration presignedUrlDuration
) {
}
