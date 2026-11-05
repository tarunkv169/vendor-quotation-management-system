package com.vqms.document.util;

import com.vqms.document.enums.DocumentFormat;

/**
 * Outcome of file validation: everything the service needs, derived from the file itself.
 *
 * @param sanitizedName safe display name (no path, no control characters)
 * @param extension     lower-case extension, already verified against the content
 * @param contentType   canonical MIME type of the detected format
 */
public record ValidatedFile(DocumentFormat format, String sanitizedName, String extension,
                            String contentType, long size) {
}
