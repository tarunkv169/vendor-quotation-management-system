package com.vqms.document.enums;

import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/**
 * Physical file formats accepted by the service.
 * Each format carries its canonical MIME type and allowed extensions.
 * Legacy .xls and macro-enabled .xlsm are deliberately not supported.
 */
public enum DocumentFormat {

    PDF("application/pdf", Set.of("pdf")),
    XLSX("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", Set.of("xlsx")),
    PNG("image/png", Set.of("png")),
    JPEG("image/jpeg", Set.of("jpg", "jpeg"));

    private final String mimeType;
    private final Set<String> extensions;

    DocumentFormat(String mimeType, Set<String> extensions) {
        this.mimeType = mimeType;
        this.extensions = extensions;
    }

    public String mimeType() {
        return mimeType;
    }

    public Set<String> extensions() {
        return extensions;
    }

    public static Optional<DocumentFormat> fromExtension(String extension) {
        if (extension == null) {
            return Optional.empty();
        }
        String normalized = extension.toLowerCase(Locale.ROOT);
        return Arrays.stream(values())
                .filter(format -> format.extensions.contains(normalized))
                .findFirst();
    }
}
