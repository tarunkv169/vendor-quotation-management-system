package com.vqms.document.util;

import java.io.IOException;
import java.io.InputStream;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.HexFormat;

/**
 * SHA-256 checksum in the two encodings we need:
 * hex for the database / duplicate detection, Base64 for the S3 integrity header.
 */
public record FileChecksum(String hex, String base64) {

    /** Streams the input once (constant memory) and computes its SHA-256. */
    public static FileChecksum sha256(InputStream input) throws IOException {
        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 not available", ex);
        }
        try (DigestInputStream digestStream = new DigestInputStream(input, digest)) {
            byte[] buffer = new byte[8192];
            while (digestStream.read(buffer) != -1) {
                // reading updates the digest
            }
        }
        byte[] hash = digest.digest();
        return new FileChecksum(HexFormat.of().formatHex(hash), Base64.getEncoder().encodeToString(hash));
    }
}
