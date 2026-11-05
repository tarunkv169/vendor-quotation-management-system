package com.vqms.document.storage.impl;

import com.vqms.document.config.S3Properties;
import com.vqms.document.exception.StorageDisabledException;
import com.vqms.document.storage.FileStorageService;
import com.vqms.document.storage.PresignedDownload;
import com.vqms.document.storage.StoredObject;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.io.InputStream;

/**
 * Active while S3 is switched off (vqms.storage.s3.enabled=false): no S3 client is created,
 * file operations are rejected with {@link StorageDisabledException}, deletes are no-ops
 * (no file can have been stored). The S3 implementation stays in place for when the flag is turned on.
 */
@Service
@ConditionalOnProperty(name = "vqms.storage.s3.enabled", havingValue = "false", matchIfMissing = true)
public class DisabledFileStorageService implements FileStorageService {

    private final S3Properties properties;

    public DisabledFileStorageService(S3Properties properties) {
        this.properties = properties;
    }

    @Override
    public StoredObject store(String storageKey, InputStream content, long contentLength, String contentType, String sha256Base64) {
        throw new StorageDisabledException();
    }

    @Override
    public PresignedDownload generateDownloadUrl(String storageKey, String downloadFileName, String contentType) {
        throw new StorageDisabledException();
    }

    @Override
    public void delete(String storageKey) {
        // Nothing stored while storage is disabled.
    }

    @Override
    public void deleteQuietly(String storageKey) {
        // Nothing stored while storage is disabled.
    }

    @Override
    public String bucketName() {
        return properties.bucket();
    }

    @Override
    public boolean isEnabled() {
        return false;
    }
}
