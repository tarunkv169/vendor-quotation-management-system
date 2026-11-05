package com.vqms.document.constants;

/**
 * Shared constants for the Document Service.
 */
public final class DocumentConstants {

    public static final String API_BASE_PATH = "/api/v1/documents";

    public static final String CORRELATION_ID_HEADER = "X-Correlation-Id";
    public static final String CORRELATION_ID_MDC_KEY = "correlationId";

    public static final String EVENT_TYPE_DOCUMENT_UPLOADED = "DOCUMENT_UPLOADED";

    /** Maximum length of the sanitized original file name stored in the database. */
    public static final int MAX_DOCUMENT_NAME_LENGTH = 200;

    /** Zip-bomb protection for OOXML (xlsx) inspection. */
    public static final int MAX_ZIP_ENTRIES = 10_000;
    public static final long MAX_ZIP_UNCOMPRESSED_BYTES = 200L * 1024 * 1024;

    private DocumentConstants() {
    }
}
