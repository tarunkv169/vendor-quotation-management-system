package com.vqms.document.service.internal;

import com.vqms.document.config.DocumentProperties;
import com.vqms.document.entity.Document;
import com.vqms.document.entity.DocumentStatusHistory;
import com.vqms.document.enums.DocumentStatus;
import com.vqms.document.repository.DocumentRepository;
import com.vqms.document.repository.DocumentStatusHistoryRepository;
import com.vqms.document.storage.FileStorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Limit;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * Repairs uploads that never finished (process crash between S3 upload and DB update).
 * Rows stuck in UPLOADING longer than {@code vqms.document.stale-upload-timeout} are marked
 * UPLOAD_FAILED and any partially stored object is removed.
 *
 * <p>{@code @Scheduled(fixedDelayString)} runs the job repeatedly, waiting the configured
 * ISO-8601 duration after each run. With several instances, rows are protected by optimistic
 * locking; for strict single execution add ShedLock later.</p>
 */
@Component
public class StaleUploadCleanupJob {

    private static final Logger log = LoggerFactory.getLogger(StaleUploadCleanupJob.class);
    private static final int BATCH_SIZE = 100;

    private final DocumentRepository documentRepository;
    private final DocumentStatusHistoryRepository historyRepository;
    private final FileStorageService fileStorageService;
    private final DocumentProperties properties;

    public StaleUploadCleanupJob(DocumentRepository documentRepository,
                                 DocumentStatusHistoryRepository historyRepository,
                                 FileStorageService fileStorageService,
                                 DocumentProperties properties) {
        this.documentRepository = documentRepository;
        this.historyRepository = historyRepository;
        this.fileStorageService = fileStorageService;
        this.properties = properties;
    }

    @Scheduled(fixedDelayString = "${vqms.document.stale-upload-cleanup-interval:PT10M}",
            initialDelayString = "PT1M")
    @Transactional
    public void cleanStaleUploads() {
        Instant cutoff = Instant.now().minus(properties.staleUploadTimeout());
        List<Document> stale = documentRepository.findByDocumentStatusAndCreatedAtBefore(
                DocumentStatus.UPLOADING, cutoff, Limit.of(BATCH_SIZE));
        if (stale.isEmpty()) {
            return;
        }
        for (Document document : stale) {
            document.markFailed(DocumentStatus.UPLOAD_FAILED, "Upload did not complete in time");
            historyRepository.save(new DocumentStatusHistory(document.getId(), DocumentStatus.UPLOADING,
                    DocumentStatus.UPLOAD_FAILED, null, "Stale upload cleaned up"));
            fileStorageService.deleteQuietly(document.getStorageKey());
        }
        log.warn("Marked {} stale uploads as UPLOAD_FAILED", stale.size());
    }
}
