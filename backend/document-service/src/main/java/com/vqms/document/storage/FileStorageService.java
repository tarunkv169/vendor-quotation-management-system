package com.vqms.document.storage;

import java.io.InputStream;

/**
 * Abstraction over the physical file store. The service layer depends only on this
 * interface, so S3 can be replaced (e.g. by Azure Blob) without touching business logic.
 * Implementations throw {@link com.vqms.document.exception.DocumentStorageException} on failure.
 */
public interface FileStorageService {

    /**
     * Streams content to storage under a server-generated key.
     *
     * @param sha256Base64 Base64 SHA-256 of the content; the store verifies integrity with it
     */
    StoredObject store(String storageKey, InputStream content, long contentLength,
                       String contentType, String sha256Base64);

    /** Creates a short-lived download URL that forces "attachment" with the given file name. */
    PresignedDownload generateDownloadUrl(String storageKey, String downloadFileName, String contentType);

    void delete(String storageKey);

    /** Best-effort delete used during compensation; never throws. */
    void deleteQuietly(String storageKey);

    String bucketName();

    /** False when no file store is configured (S3 switched off); uploads and downloads are then rejected. */
    default boolean isEnabled() {
        return true;
    }
}
