package com.vqms.service;

import com.vqms.dto.request.QuotationItemRequest;
import com.vqms.dto.request.QuotationRequest;
import com.vqms.dto.response.QuotationItemResponse;
import com.vqms.dto.response.QuotationResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

public interface QuotationService {

    QuotationResponse createQuotation(UUID requestId, QuotationRequest request, UUID userId);

    QuotationResponse uploadQuotation(UUID requestId, UUID vendorId, MultipartFile file, UUID userId);

    QuotationResponse getQuotationById(UUID id);

    Page<QuotationResponse> getQuotationsByRequestId(UUID requestId, Pageable pageable);

    Page<QuotationResponse> getQuotationsByVendorId(UUID vendorId, Pageable pageable);

    List<QuotationResponse> getAllQuotations();

    QuotationResponse processQuotation(UUID quotationId);

    QuotationResponse reviewQuotation(UUID quotationId, UUID userId);

    QuotationResponse updateQuotation(UUID id, QuotationRequest request, UUID userId);

    void deleteQuotation(UUID id, UUID userId);

    QuotationResponse retryProcessing(UUID quotationId);

    // Submit quotation for approval
    QuotationResponse submitQuotation(UUID quotationId, UUID userId);

    // Cancel quotation
    QuotationResponse cancelQuotation(UUID quotationId, UUID userId);

    // Create a new version of an existing quotation
    QuotationResponse createNewVersion(UUID quotationId, QuotationRequest request, UUID userId);

    // Add item to quotation
    QuotationItemResponse addItem(UUID quotationId, QuotationItemRequest itemRequest, UUID userId);

    // Update item in quotation
    QuotationItemResponse updateItem(UUID quotationId, UUID itemId, QuotationItemRequest itemRequest, UUID userId);

    // Delete item from quotation
    void deleteItem(UUID quotationId, UUID itemId, UUID userId);

    // Get all items for a quotation
    List<QuotationItemResponse> getItems(UUID quotationId);

    // Verify an item manually
    QuotationItemResponse verifyItem(UUID quotationId, UUID itemId, UUID userId);
}
