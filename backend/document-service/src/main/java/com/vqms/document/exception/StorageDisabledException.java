package com.vqms.document.exception;

/** Thrown when an upload or download is requested while file storage is switched off (S3_ENABLED=false). Mapped to HTTP 503. */
public class StorageDisabledException extends RuntimeException {

    public StorageDisabledException() {
        super("Document storage is disabled (S3_ENABLED=false). Enable S3 to upload or download files.");
    }
}
