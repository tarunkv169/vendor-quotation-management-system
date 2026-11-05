package com.vqms.document.service;

import com.vqms.document.dto.request.DocumentSearchRequest;
import com.vqms.document.dto.request.DocumentStatusUpdateRequest;
import com.vqms.document.dto.request.DocumentUploadRequest;
import com.vqms.document.dto.response.DocumentDownloadResponse;
import com.vqms.document.dto.response.DocumentResponse;
import com.vqms.document.dto.response.DocumentStatusHistoryResponse;
import com.vqms.document.dto.response.PageResponse;
import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

/**
 * Document use cases. All methods authorize against the current authenticated user.
 */
public interface DocumentService {

    DocumentResponse upload(MultipartFile file, DocumentUploadRequest request);

    DocumentResponse getById(UUID documentId);

    PageResponse<DocumentResponse> search(DocumentSearchRequest criteria, Pageable pageable);

    PageResponse<DocumentResponse> getByQuotation(UUID quotationId, Pageable pageable);

    PageResponse<DocumentResponse> getByVendor(UUID vendorId, Pageable pageable);

    PageResponse<DocumentResponse> getByProcurementRequest(UUID procurementRequestId, Pageable pageable);

    DocumentDownloadResponse createDownloadLink(UUID documentId);

    void delete(UUID documentId);

    DocumentResponse updateStatus(UUID documentId, DocumentStatusUpdateRequest request);

    List<DocumentStatusHistoryResponse> getStatusHistory(UUID documentId);
}
