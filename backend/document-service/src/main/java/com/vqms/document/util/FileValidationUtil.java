package com.vqms.document.util;

import com.vqms.document.config.DocumentProperties;
import com.vqms.document.constants.DocumentConstants;
import com.vqms.document.enums.DocumentFormat;
import com.vqms.document.enums.DocumentType;
import com.vqms.document.exception.InvalidDocumentException;
import org.apache.tika.Tika;
import org.apache.tika.io.TikaInputStream;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.Locale;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipException;
import java.util.zip.ZipInputStream;

/**
 * Validates uploaded files before anything is stored.
 *
 * <ol>
 *   <li>Non-empty and within the configured size limit.</li>
 *   <li>File name sanitized (path parts and unsafe characters removed).</li>
 *   <li>Extension allowed globally and for the document type.</li>
 *   <li>Real content type detected from magic bytes with Apache Tika and matched to the extension.</li>
 *   <li>XLSX: must be a real workbook, must not contain VBA macros, zip-bomb limits applied.</li>
 * </ol>
 */
@Component
public class FileValidationUtil {

    private static final Set<String> OOXML_DETECTED_TYPES = Set.of(
            "application/x-tika-ooxml",
            "application/zip",
            DocumentFormat.XLSX.mimeType());

    /** Tika facade is thread-safe and can be shared. */
    private final Tika tika = new Tika();
    private final DocumentProperties properties;

    public FileValidationUtil(DocumentProperties properties) {
        this.properties = properties;
    }

    public ValidatedFile validate(MultipartFile file, DocumentType documentType) {
        if (file == null || file.isEmpty()) {
            throw new InvalidDocumentException("File is required and must not be empty");
        }
        long maxBytes = properties.maxFileSize().toBytes();
        if (file.getSize() > maxBytes) {
            throw new InvalidDocumentException("File exceeds the maximum size of "
                    + properties.maxFileSize().toMegabytes() + " MB");
        }

        String sanitizedName = sanitizeFileName(file.getOriginalFilename());
        String extension = extractExtension(sanitizedName);

        if (!properties.allowedExtensions().contains(extension)) {
            throw new InvalidDocumentException("File extension '." + extension + "' is not allowed");
        }
        DocumentFormat format = DocumentFormat.fromExtension(extension)
                .orElseThrow(() -> new InvalidDocumentException("Unsupported file extension '." + extension + "'"));
        if (!documentType.allowedFormats().contains(format)) {
            throw new InvalidDocumentException(documentType + " does not accept " + format + " files");
        }

        String detected = detectContentType(file);
        if (!matches(format, detected)) {
            throw new InvalidDocumentException("File content does not match its extension '." + extension + "'");
        }
        if (format == DocumentFormat.XLSX) {
            inspectWorkbook(file);
        }
        return new ValidatedFile(format, sanitizedName, extension, format.mimeType(), file.getSize());
    }

    /**
     * Removes directory parts and unsafe characters. The result is used only for display
     * and Content-Disposition; it is never used as a storage path.
     */
    static String sanitizeFileName(String originalName) {
        if (!StringUtils.hasText(originalName)) {
            throw new InvalidDocumentException("File name is required");
        }
        String name = originalName.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1);
        name = name.replaceAll("[\\p{Cntrl}]", "")
                .replaceAll("[^\\p{L}\\p{N}._ ()-]", "_")
                .replaceAll("\\.{2,}", ".")
                .trim();
        while (name.startsWith(".")) {
            name = name.substring(1);
        }
        if (name.isBlank() || !name.contains(".")) {
            throw new InvalidDocumentException("File name must include a valid extension");
        }
        if (name.length() > DocumentConstants.MAX_DOCUMENT_NAME_LENGTH) {
            int dot = name.lastIndexOf('.');
            String ext = name.substring(dot);
            name = name.substring(0, DocumentConstants.MAX_DOCUMENT_NAME_LENGTH - ext.length()) + ext;
        }
        return name;
    }

    private static String extractExtension(String sanitizedName) {
        int dot = sanitizedName.lastIndexOf('.');
        if (dot < 0 || dot == sanitizedName.length() - 1) {
            throw new InvalidDocumentException("File name must include a valid extension");
        }
        return sanitizedName.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    /** Detects the type from the bytes only (no file-name hint, so a renamed file is caught). */
    private String detectContentType(MultipartFile file) {
        try (InputStream in = TikaInputStream.get(file.getInputStream())) {
            return tika.detect(in);
        } catch (IOException ex) {
            throw new UncheckedIOException("Unable to read uploaded file", ex);
        }
    }

    private static boolean matches(DocumentFormat format, String detected) {
        if (detected == null) {
            return false;
        }
        return switch (format) {
            case PDF -> detected.equals("application/pdf");
            case PNG -> detected.equals("image/png");
            case JPEG -> detected.equals("image/jpeg");
            case XLSX -> OOXML_DETECTED_TYPES.contains(detected);
        };
    }

    /**
     * Walks the OOXML zip: requires xl/workbook.xml, rejects vbaProject.bin (macros),
     * limits entry count and total uncompressed size (zip bomb protection).
     */
    private static void inspectWorkbook(MultipartFile file) {
        boolean hasWorkbook = false;
        int entries = 0;
        long totalUncompressed = 0;
        byte[] buffer = new byte[8192];

        try (ZipInputStream zip = new ZipInputStream(file.getInputStream())) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (++entries > DocumentConstants.MAX_ZIP_ENTRIES) {
                    throw new InvalidDocumentException("Workbook contains too many entries");
                }
                String name = entry.getName().toLowerCase(Locale.ROOT);
                if (name.endsWith("vbaproject.bin")) {
                    throw new InvalidDocumentException("Macro-enabled workbooks are not allowed");
                }
                if (name.equals("xl/workbook.xml")) {
                    hasWorkbook = true;
                }
                int read;
                while ((read = zip.read(buffer)) != -1) {
                    totalUncompressed += read;
                    if (totalUncompressed > DocumentConstants.MAX_ZIP_UNCOMPRESSED_BYTES) {
                        throw new InvalidDocumentException("Workbook expands beyond the allowed size");
                    }
                }
            }
        } catch (ZipException ex) {
            throw new InvalidDocumentException("Workbook is corrupted or not a valid XLSX file");
        } catch (IOException ex) {
            throw new UncheckedIOException("Unable to read uploaded workbook", ex);
        }
        if (!hasWorkbook) {
            throw new InvalidDocumentException("File is not a valid Excel workbook");
        }
    }
}
