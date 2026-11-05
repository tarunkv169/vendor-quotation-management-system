package com.vqms.document.storage;

import java.time.Instant;

/** A time-limited download URL for one stored object. */
public record PresignedDownload(String url, Instant expiresAt) {
}
