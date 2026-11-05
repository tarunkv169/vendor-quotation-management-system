package com.vqms.document.service.impl;

import com.vqms.document.client.QuotationServiceClient;
import com.vqms.document.client.VendorServiceClient;
import com.vqms.document.client.dto.QuotationSummary;
import com.vqms.document.config.DocumentProperties;
import com.vqms.document.config.S3Properties;
import com.vqms.document.exception.StorageDisabledException;
import com.vqms.document.constants.DocumentConstants;
import com.vqms.document.dto.request.DocumentSearchRequest;
import com.vqms.document.dto.request.DocumentStatusUpdateRequest;
import com.vqms.document.dto.request.DocumentUploadRequest;
import com.vqms.document.dto.response.DocumentDownloadResponse;
import com.vqms.document.dto.response.DocumentResponse;
import com.vqms.document.dto.response.DocumentStatusHistoryResponse;
import com.vqms.document.dto.response.PageResponse;
import com.vqms.document.entity.Document;
import com.vqms.document.entity.DocumentStatusHistory;
import com.vqms.document.enums.DocumentStatus;
import com.vqms.document.enums.DocumentType;
import com.vqms.document.event.DocumentUploadedEvent;
import com.vqms.document.exception.DocumentAccessDeniedException;
import com.vqms.document.exception.DocumentNotFoundException;
import com.vqms.document.exception.DocumentStorageException;
import com.vqms.document.exception.DuplicateDocumentException;
import com.vqms.document.exception.InvalidDocumentException;
import com.vqms.document.exception.InvalidDocumentStateException;
import com.vqms.document.mapper.DocumentMapper;
import com.vqms.document.repository.DocumentRepository;
import com.vqms.document.repository.DocumentSpecifications;
import com.vqms.document.repository.DocumentStatusHistoryRepository;
import com.vqms.document.security.AuthenticatedUser;
import com.vqms.document.security.CurrentUserProvider;
import com.vqms.document.security.DocumentAccessPolicy;
import com.vqms.document.service.DocumentService;
import com.vqms.document.storage.FileStorageService;
import com.vqms.document.storage.PresignedDownload;
import com.vqms.document.util.FileChecksum;
import com.vqms.document.util.FileValidationUtil;
import com.vqms.document.util.ValidatedFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Business logic for documents.
 *
 * <h2>Upload consistency (S3 + PostgreSQL)</h2>
 * The S3 call is deliberately kept outside any database transaction:
 * <ol>
 *   <li>TX 1: insert row with status UPLOADING (the unique indexes stop concurrent duplicates).</li>
 *   <li>Stream the file to S3 (no DB connection held during the network call).</li>
 *   <li>TX 2: mark ACTIVE, write history, publish the event (sent after commit).</li>
 * </ol>
 * If S3 fails, the row becomes UPLOAD_FAILED. If TX 2 fails, the S3 object is deleted.
 * If the process crashes in between, {@code StaleUploadCleanupJob} repairs the row later.
 */
@Service
public class DocumentServiceImpl implements DocumentService {

    private static final Logger log = LoggerFactory.getLogger(DocumentServiceImpl.class);

    private static final Set<String> SORTABLE_PROPERTIES =
            Set.of("createdAt", "updatedAt", "documentName", "fileSize", "documentType", "documentStatus");
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.DESC, "createdAt");

    private final DocumentRepository documentRepository;
    private final DocumentStatusHistoryRepository historyRepository;
    private final FileStorageService fileStorageService;
    private final FileValidationUtil fileValidationUtil;
    private final DocumentMapper documentMapper;
    private final CurrentUserProvider currentUserProvider;
    private final DocumentAccessPolicy accessPolicy;
    private final QuotationServiceClient quotationServiceClient;
    private final VendorServiceClient vendorServiceClient;
    private final ApplicationEventPublisher eventPublisher;
    private final TransactionTemplate transactionTemplate;
    private final DocumentProperties documentProperties;
    private final S3Properties s3Properties;

    public DocumentServiceImpl(DocumentRepository documentRepository,
                               DocumentStatusHistoryRepository historyRepository,
                               FileStorageService fileStorageService,
                               FileValidationUtil fileValidationUtil,
                               DocumentMapper documentMapper,
                               CurrentUserProvider currentUserProvider,
                               DocumentAccessPolicy accessPolicy,
                               QuotationServiceClient quotationServiceClient,
                               VendorServiceClient vendorServiceClient,
                               ApplicationEventPublisher eventPublisher,
                               TransactionTemplate transactionTemplate,
                               DocumentProperties documentProperties,
                               S3Properties s3Properties) {
        this.documentRepository = documentRepository;
        this.historyRepository = historyRepository;
        this.fileStorageService = fileStorageService;
        this.fileValidationUtil = fileValidationUtil;
        this.documentMapper = documentMapper;
        this.currentUserProvider = currentUserProvider;
        this.accessPolicy = accessPolicy;
        this.quotationServiceClient = quotationServiceClient;
        this.vendorServiceClient = vendorServiceClient;
        this.eventPublisher = eventPublisher;
        this.transactionTemplate = transactionTemplate;
        this.documentProperties = documentProperties;
        this.s3Properties = s3Properties;
    }

    // ------------------------------------------------------------------ upload

    /** Not annotated with @Transactional on purpose - see class documentation. */
    @Override
    public DocumentResponse upload(MultipartFile file, DocumentUploadRequest request) {
        if (!fileStorageService.isEnabled()) {
            throw new StorageDisabledException();
        }
        AuthenticatedUser user = currentUserProvider.getCurrentUser();
        accessPolicy.assertCanUpload(user, request.documentType());

        ValidatedFile validated = fileValidationUtil.validate(file, request.documentType());
        UploadScope scope = resolveUploadScope(user, request);
        FileChecksum checksum = computeChecksum(file);
        assertNotDuplicate(scope, checksum.hex());

        String storedFileName = UUID.randomUUID() + "." + validated.extension();
        String storageKey = buildStorageKey(storedFileName);

        // TX 1: reserve the metadata row.
        Document pending;
        try {
            pending = transactionTemplate.execute(status -> {
                Document document = Document.builder()
                        .documentName(validated.sanitizedName())
                        .storedFileName(storedFileName)
                        .documentType(request.documentType())
                        .ownerId(user.userId())
                        .vendorId(scope.vendorId())
                        .quotationId(scope.quotationId())
                        .procurementRequestId(scope.procurementRequestId())
                        .storageKey(storageKey)
                        .bucketName(fileStorageService.bucketName())
                        .contentType(validated.contentType())
                        .fileSize(validated.size())
                        .checksum(checksum.hex())
                        .description(request.description())
                        .build();
                Document saved = documentRepository.saveAndFlush(document);
                recordHistory(saved.getId(), null, DocumentStatus.UPLOADING, user.userId(), "Upload started");
                return saved;
            });
        } catch (DataIntegrityViolationException ex) {
            throw new DuplicateDocumentException("This file has already been uploaded for the same reference");
        }
        Objects.requireNonNull(pending, "Document reservation returned null");

        // Step 2: stream to S3 outside any transaction.
        try (InputStream content = file.getInputStream()) {
            fileStorageService.store(storageKey, content, validated.size(), validated.contentType(), checksum.base64());
        } catch (IOException | DocumentStorageException ex) {
            markUploadFailed(pending.getId(), user.userId(), "File could not be stored");
            if (ex instanceof DocumentStorageException storageException) {
                throw storageException;
            }
            throw new DocumentStorageException("Failed to read uploaded file", ex);
        }

        // TX 2: activate and publish. Compensate the S3 object if this fails.
        try {
            DocumentResponse response = transactionTemplate.execute(status -> {
                Document document = documentRepository.findById(pending.getId())
                        .orElseThrow(() -> new DocumentNotFoundException(pending.getId()));
                DocumentStatus previous = document.getDocumentStatus();
                document.transitionTo(DocumentStatus.ACTIVE);
                Document saved = documentRepository.saveAndFlush(document);
                recordHistory(saved.getId(), previous, DocumentStatus.ACTIVE, user.userId(), "Upload completed");
                eventPublisher.publishEvent(DocumentUploadedEvent.from(saved, currentCorrelationId()));
                return documentMapper.toResponse(saved);
            });
            log.info("Document {} uploaded by user {} (type={}, size={})",
                    pending.getId(), user.userId(), request.documentType(), validated.size());
            return response;
        } catch (RuntimeException ex) {
            log.error("Activating document {} failed; removing stored object", pending.getId(), ex);
            fileStorageService.deleteQuietly(storageKey);
            markUploadFailed(pending.getId(), user.userId(), "Upload could not be completed");
            throw ex;
        }
    }

    /**
     * Determines vendor / quotation / procurement references from trusted sources only:
     * the Quotation Service for quotation documents and the JWT for vendor users.
     */
    private UploadScope resolveUploadScope(AuthenticatedUser user, DocumentUploadRequest request) {
        DocumentType type = request.documentType();

        if (type.requiresQuotation() && request.quotationId() == null) {
            throw new InvalidDocumentException("quotationId is required for " + type);
        }

        if (request.quotationId() != null) {
            if (type == DocumentType.VENDOR_CERTIFICATE || type == DocumentType.PROCUREMENT_ATTACHMENT) {
                throw new InvalidDocumentException(type + " cannot be attached to a quotation");
            }
            QuotationSummary quotation = quotationServiceClient.getQuotation(request.quotationId());
            if (user.isVendor()) {
                if (!quotation.vendorId().equals(user.vendorId())) {
                    throw new DocumentAccessDeniedException("You can only upload documents to your own quotations");
                }
                if (!quotation.isEditableByVendor()) {
                    throw new InvalidDocumentStateException(
                            "Documents can only be added while the quotation is in DRAFT status");
                }
            }
            if (request.vendorId() != null && !request.vendorId().equals(quotation.vendorId())) {
                throw new InvalidDocumentException("vendorId does not match the quotation's vendor");
            }
            if (request.procurementRequestId() != null
                    && !request.procurementRequestId().equals(quotation.procurementRequestId())) {
                throw new InvalidDocumentException("procurementRequestId does not match the quotation");
            }
            return new UploadScope(quotation.vendorId(), quotation.id(), quotation.procurementRequestId());
        }

        if (type == DocumentType.PROCUREMENT_ATTACHMENT) {
            if (request.procurementRequestId() == null) {
                throw new InvalidDocumentException("procurementRequestId is required for " + type);
            }
            if (request.vendorId() != null) {
                throw new InvalidDocumentException("vendorId must not be set for " + type);
            }
            return new UploadScope(null, null, request.procurementRequestId());
        }

        // VENDOR_CERTIFICATE or vendor-level SUPPORTING_DOCUMENT
        if (request.procurementRequestId() != null) {
            throw new InvalidDocumentException(
                    "Attach procurement-specific documents through the quotation (quotationId)");
        }
        UUID vendorId;
        if (user.isVendor()) {
            if (request.vendorId() != null && !request.vendorId().equals(user.vendorId())) {
                throw new DocumentAccessDeniedException("Vendors can only upload documents for themselves");
            }
            vendorId = user.vendorId();
        } else {
            if (request.vendorId() == null) {
                throw new InvalidDocumentException("vendorId is required for " + type);
            }
            vendorId = request.vendorId();
        }
        vendorServiceClient.assertVendorActive(vendorId);
        return new UploadScope(vendorId, null, null);
    }

    private void assertNotDuplicate(UploadScope scope, String checksum) {
        Set<DocumentStatus> ignored = DocumentStatus.ignoredForDuplicateCheck();
        boolean duplicate;
        if (scope.quotationId() != null) {
            duplicate = documentRepository.existsByQuotationIdAndChecksumAndDocumentStatusNotIn(
                    scope.quotationId(), checksum, ignored);
        } else if (scope.vendorId() != null) {
            duplicate = documentRepository.existsByVendorIdAndQuotationIdIsNullAndChecksumAndDocumentStatusNotIn(
                    scope.vendorId(), checksum, ignored);
        } else {
            duplicate = documentRepository
                    .existsByProcurementRequestIdAndQuotationIdIsNullAndVendorIdIsNullAndChecksumAndDocumentStatusNotIn(
                            scope.procurementRequestId(), checksum, ignored);
        }
        if (duplicate) {
            throw new DuplicateDocumentException("This file has already been uploaded for the same reference");
        }
    }

    private static FileChecksum computeChecksum(MultipartFile file) {
        try (InputStream in = file.getInputStream()) {
            return FileChecksum.sha256(in);
        } catch (IOException ex) {
            throw new UncheckedIOException("Unable to read uploaded file", ex);
        }
    }

    /** {prefix}/{yyyy}/{MM}/{uuid}.{ext} - fully server-generated, no user input. */
    private String buildStorageKey(String storedFileName) {
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
        return String.format("%s/%04d/%02d/%s",
                s3Properties.keyPrefix(), now.getYear(), now.getMonthValue(), storedFileName);
    }

    private void markUploadFailed(UUID documentId, UUID userId, String reason) {
        try {
            transactionTemplate.executeWithoutResult(status ->
                    documentRepository.findById(documentId).ifPresent(document -> {
                        if (document.getDocumentStatus().canTransitionTo(DocumentStatus.UPLOAD_FAILED)) {
                            DocumentStatus previous = document.getDocumentStatus();
                            document.markFailed(DocumentStatus.UPLOAD_FAILED, reason);
                            recordHistory(documentId, previous, DocumentStatus.UPLOAD_FAILED, userId, reason);
                        }
                    }));
        } catch (RuntimeException ex) {
            log.error("Could not mark document {} as UPLOAD_FAILED; cleanup job will retry", documentId, ex);
        }
    }

    // ------------------------------------------------------------------ queries

    @Override
    @Transactional(readOnly = true)
    public DocumentResponse getById(UUID documentId) {
        AuthenticatedUser user = currentUserProvider.getCurrentUser();
        Document document = findExisting(documentId);
        accessPolicy.assertCanRead(user, document);
        return documentMapper.toResponse(document);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<DocumentResponse> search(DocumentSearchRequest criteria, Pageable pageable) {
        AuthenticatedUser user = currentUserProvider.getCurrentUser();
        DocumentSearchRequest effective = criteria == null
                ? new DocumentSearchRequest(null, null, null, null, null)
                : criteria;

        if (effective.status() == DocumentStatus.DELETED) {
            accessPolicy.assertCanViewDeleted(user);
        }
        if (user.isVendor()) {
            accessPolicy.assertCanQueryVendor(user, effective.vendorId());
            effective = effective.withVendorId(user.vendorId());
        }

        return PageResponse.from(
                documentRepository.findAll(
                        DocumentSpecifications.matching(
                                effective.documentType(),
                                effective.status(),
                                effective.quotationId(),
                                effective.vendorId(),
                                effective.procurementRequestId()),
                        sanitize(pageable)),
                documentMapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<DocumentResponse> getByQuotation(UUID quotationId, Pageable pageable) {
        return search(DocumentSearchRequest.byQuotation(quotationId), pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<DocumentResponse> getByVendor(UUID vendorId, Pageable pageable) {
        accessPolicy.assertCanQueryVendor(currentUserProvider.getCurrentUser(), vendorId);
        return search(DocumentSearchRequest.byVendor(vendorId), pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<DocumentResponse> getByProcurementRequest(UUID procurementRequestId, Pageable pageable) {
        return search(DocumentSearchRequest.byProcurementRequest(procurementRequestId), pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public DocumentDownloadResponse createDownloadLink(UUID documentId) {
        if (!fileStorageService.isEnabled()) {
            throw new StorageDisabledException();
        }
        AuthenticatedUser user = currentUserProvider.getCurrentUser();
        Document document = findExisting(documentId);
        accessPolicy.assertCanRead(user, document);

        if (!document.getDocumentStatus().isDownloadable()) {
            throw new InvalidDocumentStateException(
                    "Document is not available for download in status " + document.getDocumentStatus());
        }
        PresignedDownload link = fileStorageService.generateDownloadUrl(
                document.getStorageKey(), document.getDocumentName(), document.getContentType());

        log.info("Download link issued for document {} to user {} (role={})",
                documentId, user.userId(), user.role());
        return new DocumentDownloadResponse(
                document.getId(),
                document.getDocumentName(),
                document.getContentType(),
                document.getFileSize(),
                document.getChecksum(),
                link.url(),
                link.expiresAt());
    }

    @Override
    @Transactional(readOnly = true)
    public List<DocumentStatusHistoryResponse> getStatusHistory(UUID documentId) {
        AuthenticatedUser user = currentUserProvider.getCurrentUser();
        Document document = findExisting(documentId);
        accessPolicy.assertCanRead(user, document);
        return historyRepository.findByDocumentIdOrderByCreatedAtAsc(documentId).stream()
                .map(documentMapper::toHistoryResponse)
                .toList();
    }

    // ------------------------------------------------------------------ commands

    @Override
    @Transactional
    public void delete(UUID documentId) {
        AuthenticatedUser user = currentUserProvider.getCurrentUser();
        Document document = findExisting(documentId);
        accessPolicy.assertCanDelete(user, document);

        if (user.isVendor() && document.getQuotationId() != null) {
            QuotationSummary quotation = quotationServiceClient.getQuotation(document.getQuotationId());
            if (!quotation.isEditableByVendor()) {
                throw new InvalidDocumentStateException(
                        "Documents can only be removed while the quotation is in DRAFT status");
            }
        }

        DocumentStatus previous = document.getDocumentStatus();
        document.markDeleted(user.userId(), Instant.now());
        recordHistory(documentId, previous, DocumentStatus.DELETED, user.userId(), "Deleted");

        if (documentProperties.purgeFileOnDelete()) {
            String storageKey = document.getStorageKey();
            // Remove the file only after the soft delete is committed.
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    fileStorageService.deleteQuietly(storageKey);
                }
            });
        }
        log.info("Document {} deleted by user {}", documentId, user.userId());
    }

    @Override
    @Transactional
    public DocumentResponse updateStatus(UUID documentId, DocumentStatusUpdateRequest request) {
        AuthenticatedUser user = currentUserProvider.getCurrentUser();
        DocumentStatus target = request.status();
        if (!target.isManuallyAssignable()) {
            throw new InvalidDocumentException("Status " + target + " cannot be set through this endpoint");
        }
        accessPolicy.assertCanChangeStatus(user, target);

        Document document = findExisting(documentId);
        DocumentStatus previous = document.getDocumentStatus();
        if (target == DocumentStatus.FAILED) {
            document.markFailed(DocumentStatus.FAILED, request.reason());
        } else {
            document.transitionTo(target);
        }
        Document saved = documentRepository.saveAndFlush(document);
        recordHistory(documentId, previous, target, user.userId(), request.reason());
        log.info("Document {} status {} -> {} by user {}", documentId, previous, target, user.userId());
        return documentMapper.toResponse(saved);
    }

    // ------------------------------------------------------------------ helpers

    private Document findExisting(UUID documentId) {
        return documentRepository.findByIdAndDocumentStatusNot(documentId, DocumentStatus.DELETED)
                .orElseThrow(() -> new DocumentNotFoundException(documentId));
    }

    private void recordHistory(UUID documentId, DocumentStatus from, DocumentStatus to, UUID changedBy, String reason) {
        historyRepository.save(new DocumentStatusHistory(documentId, from, to, changedBy, reason));
    }

    /** Only whitelisted sort properties are accepted (unknown ones would cause a 500). */
    private static Pageable sanitize(Pageable pageable) {
        Sort sort = Sort.by(pageable.getSort().stream()
                .filter(order -> SORTABLE_PROPERTIES.contains(order.getProperty()))
                .toList());
        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
                sort.isSorted() ? sort : DEFAULT_SORT);
    }

    private static String currentCorrelationId() {
        String id = MDC.get(DocumentConstants.CORRELATION_ID_MDC_KEY);
        return id != null ? id : UUID.randomUUID().toString();
    }

    /** Trusted references resolved for an upload. */
    private record UploadScope(UUID vendorId, UUID quotationId, UUID procurementRequestId) {
    }
}
