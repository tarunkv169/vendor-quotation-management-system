package com.vqms.document.enums;

import java.util.Set;

/**
 * Business type of a document. Each type restricts which physical formats are allowed
 * and whether it must be attached to a quotation.
 */
public enum DocumentType {

    /** Vendor quotation in PDF form (native or scanned). */
    QUOTATION_PDF(Set.of(DocumentFormat.PDF), true),

    /** Vendor quotation as an Excel workbook. */
    QUOTATION_EXCEL(Set.of(DocumentFormat.XLSX), true),

    /** Vendor certificate (GST, ISO, registration...). Scoped to a vendor. */
    VENDOR_CERTIFICATE(Set.of(DocumentFormat.PDF, DocumentFormat.PNG, DocumentFormat.JPEG), false),

    /** Supporting document: attached to a quotation or to a vendor profile. */
    SUPPORTING_DOCUMENT(Set.of(DocumentFormat.PDF, DocumentFormat.XLSX, DocumentFormat.PNG, DocumentFormat.JPEG), false),

    /** Attachment published by procurement staff on a procurement request (RFQ specs etc.). */
    PROCUREMENT_ATTACHMENT(Set.of(DocumentFormat.PDF, DocumentFormat.XLSX, DocumentFormat.PNG, DocumentFormat.JPEG), false);

    private final Set<DocumentFormat> allowedFormats;
    private final boolean requiresQuotation;

    DocumentType(Set<DocumentFormat> allowedFormats, boolean requiresQuotation) {
        this.allowedFormats = allowedFormats;
        this.requiresQuotation = requiresQuotation;
    }

    public Set<DocumentFormat> allowedFormats() {
        return allowedFormats;
    }

    public boolean requiresQuotation() {
        return requiresQuotation;
    }

    /** True when the document may be sent to the AI Extraction Service. */
    public boolean isExtractable() {
        return this == QUOTATION_PDF || this == QUOTATION_EXCEL;
    }
}
