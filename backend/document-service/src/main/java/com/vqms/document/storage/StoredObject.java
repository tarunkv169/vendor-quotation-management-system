package com.vqms.document.storage;

/**
 * Result of a successful upload to object storage.
 *
 * @param versionId S3 object version (null when bucket versioning is disabled)
 */
public record StoredObject(String bucketName, String storageKey, String eTag, String versionId) {
}
