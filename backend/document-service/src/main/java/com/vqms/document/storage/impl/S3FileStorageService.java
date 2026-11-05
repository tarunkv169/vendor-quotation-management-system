package com.vqms.document.storage.impl;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import com.vqms.document.config.S3Properties;
import com.vqms.document.exception.DocumentStorageException;
import com.vqms.document.storage.FileStorageService;
import com.vqms.document.storage.PresignedDownload;
import com.vqms.document.storage.StoredObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ContentDisposition;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectResponse;
import software.amazon.awssdk.services.s3.model.ServerSideEncryption;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * AWS S3 implementation of {@link FileStorageService}.
 *
 * <ul>
 *   <li>Objects are written with server-side encryption (SSE-S3, AES256).</li>
 *   <li>The precomputed SHA-256 is sent as {@code x-amz-checksum-sha256}; S3 rejects the
 *       upload if the received bytes do not match, so corrupted uploads never get stored.</li>
 *   <li>Downloads use presigned GET URLs that force {@code Content-Disposition: attachment}
 *       with a safely encoded file name (RFC 5987), preventing inline rendering and header injection.</li>
 * </ul>
 */
@Service
@ConditionalOnProperty(name = "vqms.storage.s3.enabled", havingValue = "true")
public class S3FileStorageService implements FileStorageService {

    private static final Logger log = LoggerFactory.getLogger(S3FileStorageService.class);

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final S3Properties properties;

    public S3FileStorageService(S3Client s3Client, S3Presigner s3Presigner, S3Properties properties) {
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
        this.properties = properties;
    }

    @Override
    public StoredObject store(String storageKey, InputStream content, long contentLength,
                              String contentType, String sha256Base64) {
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(properties.bucket())
                .key(storageKey)
                .contentType(contentType)
                .contentLength(contentLength)
                .checksumSHA256(sha256Base64)
                .serverSideEncryption(ServerSideEncryption.AES256)
                .build();
        try {
            PutObjectResponse response = s3Client.putObject(request, RequestBody.fromInputStream(content, contentLength));
            log.info("Stored object key={} size={}", storageKey, contentLength);
            return new StoredObject(properties.bucket(), storageKey, response.eTag(), response.versionId());
        } catch (SdkException ex) {
            log.error("S3 upload failed for key={}", storageKey, ex);
            throw new DocumentStorageException("Failed to store document file", ex);
        }
    }

    @Override
    public PresignedDownload generateDownloadUrl(String storageKey, String downloadFileName, String contentType) {
        String disposition = ContentDisposition.attachment()
                .filename(downloadFileName, StandardCharsets.UTF_8)
                .build()
                .toString();

        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(properties.bucket())
                .key(storageKey)
                .responseContentDisposition(disposition)
                .responseContentType(contentType)
                .build();

        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(properties.presignedUrlDuration())
                .getObjectRequest(getObjectRequest)
                .build();
        try {
            PresignedGetObjectRequest presigned = s3Presigner.presignGetObject(presignRequest);
            return new PresignedDownload(presigned.url().toString(), presigned.expiration());
        } catch (SdkException ex) {
            log.error("Failed to presign download for key={}", storageKey, ex);
            throw new DocumentStorageException("Failed to generate download link", ex);
        }
    }

    @Override
    public void delete(String storageKey) {
        try {
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(properties.bucket())
                    .key(storageKey)
                    .build());
            log.info("Deleted object key={}", storageKey);
        } catch (SdkException ex) {
            log.error("S3 delete failed for key={}", storageKey, ex);
            throw new DocumentStorageException("Failed to delete document file", ex);
        }
    }

    @Override
    public void deleteQuietly(String storageKey) {
        try {
            delete(storageKey);
        } catch (DocumentStorageException ex) {
            log.warn("Best-effort delete failed for key={}; object may need manual cleanup", storageKey);
        }
    }

    @Override
    public String bucketName() {
        return properties.bucket();
    }
}
