package com.vqms.service.impl;

import com.vqms.notification.NotificationType;
import com.vqms.notification.Notifier;
import com.vqms.notification.Notifier.Recipients;

import com.vqms.dto.request.QuotationItemRequest;
import com.vqms.dto.request.QuotationRequest;
import com.vqms.dto.response.QuotationItemResponse;
import com.vqms.dto.response.QuotationResponse;
import com.vqms.entity.*;
import com.vqms.exception.BadRequestException;
import com.vqms.repository.*;
import com.vqms.service.QuotationService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.domain.Sort;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class QuotationServiceImpl implements QuotationService {

    private final QuotationRepository quotationRepository;
    private final QuotationItemRepository quotationItemRepository;
    private final ProcurementRequestRepository procurementRequestRepository;
    private final VendorRepository vendorRepository;
    private final Notifier notifier;

    @Value("${vqms.upload.dir:./uploads}")
    private String uploadDir;

    @Override
    public QuotationResponse createQuotation(UUID requestId, QuotationRequest request, UUID userId) {
        ProcurementRequest pr = procurementRequestRepository.findById(requestId)
                .orElseThrow(() -> new EntityNotFoundException("Purchase request not found"));
        Vendor vendor = vendorRepository.findById(request.getVendorId())
                .orElseThrow(() -> new EntityNotFoundException("Vendor not found"));

        Quotation quotation = new Quotation();
        quotation.setPurchaseRequestId(requestId);
        quotation.setVendorId(request.getVendorId());
        quotation.setStatus(QuotationStatus.UPLOADED);
        quotation.setFileName("manual_entry");
        quotation.setFilePath("");
        quotation.setVersion(1);
        quotation.setCreatedBy(userId);

        if (request.getQuotationDate() != null) {
            quotation.setQuotationDate(LocalDate.parse(request.getQuotationDate()));
        }
        if (request.getValidUntil() != null) {
            quotation.setValidUntil(LocalDate.parse(request.getValidUntil()));
        }
        if (request.getSubmissionDeadline() != null) {
            quotation.setSubmissionDeadline(LocalDate.parse(request.getSubmissionDeadline()));
        }
        quotation.setCurrency(request.getCurrency() != null ? request.getCurrency() : "USD");
        quotation.setTaxAmount(request.getTaxAmount());
        quotation.setDiscountAmount(request.getDiscountAmount());
        quotation.setPaymentTerms(request.getPaymentTerms());
        quotation.setDeliveryDays(request.getDeliveryDays());
        quotation.setWarrantyPeriod(request.getWarrantyPeriod());
        quotation.setNotes(request.getNotes());

        Quotation saved = quotationRepository.save(quotation);

        if (request.getItems() != null) {
            BigDecimal total = BigDecimal.ZERO;
            for (QuotationItemRequest itemReq : request.getItems()) {
                QuotationItem item = new QuotationItem();
                item.setQuotationId(saved.getId());
                item.setItemName(itemReq.getItemName());
                item.setDescription(itemReq.getDescription());
                item.setQuantity(itemReq.getQuantity());
                item.setUnit(itemReq.getUnit());
                item.setUnitPrice(itemReq.getUnitPrice());
                item.setCurrency(itemReq.getCurrency() != null ? itemReq.getCurrency() : "USD");
                item.setSpecification(itemReq.getSpecification());
                item.setDeliveryDays(itemReq.getDeliveryDays());
                quotationItemRepository.save(item);
                total = total.add(item.getLineTotal());
            }
            saved.setTotalAmount(total);
            quotationRepository.save(saved);
        }

        return toResponse(saved);
    }

    @Override
    public QuotationResponse uploadQuotation(UUID requestId, UUID vendorId, MultipartFile file, UUID userId) {
        procurementRequestRepository.findById(requestId)
                .orElseThrow(() -> new EntityNotFoundException("Purchase request not found"));
        vendorRepository.findById(vendorId)
                .orElseThrow(() -> new EntityNotFoundException("Vendor not found"));

        if (file.isEmpty()) {
            throw new BadRequestException("Uploaded file is empty");
        }

        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "unknown";
        String storedName = UUID.randomUUID() + "_" + originalName;
        String filePath = uploadDir + "/" + storedName;

        try {
            Path path = Paths.get(uploadDir);
            if (!Files.exists(path)) {
                Files.createDirectories(path);
            }
            Files.copy(file.getInputStream(), Paths.get(filePath), StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new BadRequestException("Failed to upload file: " + e.getMessage());
        }

        Quotation quotation = new Quotation();
        quotation.setPurchaseRequestId(requestId);
        quotation.setVendorId(vendorId);
        quotation.setStatus(QuotationStatus.UPLOADED);
        quotation.setVersion(1);
        quotation.setFileName(originalName);
        quotation.setFilePath(filePath);
        quotation.setFileSize(file.getSize());
        quotation.setContentType(file.getContentType());
        quotation.setCreatedBy(userId);

        Quotation saved = quotationRepository.save(quotation);
        return toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public QuotationResponse getQuotationById(UUID id) {
        Quotation quotation = quotationRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Quotation not found"));
        return toResponse(quotation);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<QuotationResponse> getQuotationsByRequestId(UUID requestId, Pageable pageable) {
        return quotationRepository.findByPurchaseRequestId(requestId, pageable).map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<QuotationResponse> getQuotationsByVendorId(UUID vendorId, Pageable pageable) {
        return quotationRepository.findByVendorId(vendorId, pageable).map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public List<QuotationResponse> getAllQuotations() {
        return quotationRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"))
                .stream().map(this::toResponse).toList();
    }

    @Override
    public QuotationResponse processQuotation(UUID quotationId) {
        Quotation quotation = quotationRepository.findById(quotationId)
                .orElseThrow(() -> new EntityNotFoundException("Quotation not found"));

        quotation.setStatus(QuotationStatus.QUEUED);
        quotation.setProcessingAttempts(quotation.getProcessingAttempts() + 1);
        quotation.setLastProcessingAt(LocalDateTime.now());

        // Processing is simulated here; AI extraction runs through the AI Extraction Service API
        quotation.setStatus(QuotationStatus.EXTRACTED);
        quotation.setExtractionConfidence(BigDecimal.valueOf(0.85));

        Quotation saved = quotationRepository.save(quotation);
        return toResponse(saved);
    }

    @Override
    public QuotationResponse reviewQuotation(UUID quotationId, UUID userId) {
        Quotation quotation = quotationRepository.findById(quotationId)
                .orElseThrow(() -> new EntityNotFoundException("Quotation not found"));

        quotation.setStatus(QuotationStatus.VALIDATED);
        quotation.setReviewedBy(userId);
        quotation.setReviewedAt(LocalDateTime.now());

        Quotation saved = quotationRepository.save(quotation);

        String requestTitle = procurementRequestRepository.findById(quotation.getPurchaseRequestId())
                .map(ProcurementRequest::getTitle).orElse("the request");
        Recipients owners = Recipients.users(quotation.getCreatedBy());
        if (quotation.getSubmittedBy() != null) {
            owners.andUser(quotation.getSubmittedBy());
        }
        notifier.notify(owners.except(userId), NotificationType.QUOTATION_REVIEWED, "Quotation reviewed",
                "Your quotation for \"" + requestTitle + "\" has been reviewed.",
                Notifier.QUOTATION, saved.getId());
        return toResponse(saved);
    }

    @Override
    public QuotationResponse updateQuotation(UUID id, QuotationRequest request, UUID userId) {
        Quotation quotation = quotationRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Quotation not found"));

        if (!quotation.getStatus().equals(QuotationStatus.UPLOADED)
                && !quotation.getStatus().equals(QuotationStatus.NEEDS_REVIEW)
                && !quotation.getStatus().equals(QuotationStatus.FAILED)) {
            throw new BadRequestException("Quotation cannot be updated in " + quotation.getStatus() + " status");
        }

        if (request.getQuotationDate() != null) {
            quotation.setQuotationDate(LocalDate.parse(request.getQuotationDate()));
        }
        if (request.getValidUntil() != null) {
            quotation.setValidUntil(LocalDate.parse(request.getValidUntil()));
        }
        if (request.getSubmissionDeadline() != null) {
            quotation.setSubmissionDeadline(LocalDate.parse(request.getSubmissionDeadline()));
        }
        if (request.getCurrency() != null) {
            quotation.setCurrency(request.getCurrency());
        }
        quotation.setTaxAmount(request.getTaxAmount());
        quotation.setDiscountAmount(request.getDiscountAmount());
        quotation.setPaymentTerms(request.getPaymentTerms());
        quotation.setDeliveryDays(request.getDeliveryDays());
        quotation.setWarrantyPeriod(request.getWarrantyPeriod());
        quotation.setNotes(request.getNotes());

        Quotation saved = quotationRepository.save(quotation);

        // Update items if provided
        if (request.getItems() != null) {
            quotationItemRepository.deleteByQuotationId(id);
            BigDecimal total = BigDecimal.ZERO;
            for (QuotationItemRequest itemReq : request.getItems()) {
                QuotationItem item = new QuotationItem();
                item.setQuotationId(saved.getId());
                item.setItemName(itemReq.getItemName());
                item.setDescription(itemReq.getDescription());
                item.setQuantity(itemReq.getQuantity());
                item.setUnit(itemReq.getUnit());
                item.setUnitPrice(itemReq.getUnitPrice());
                item.setCurrency(itemReq.getCurrency() != null ? itemReq.getCurrency() : "USD");
                item.setSpecification(itemReq.getSpecification());
                item.setDeliveryDays(itemReq.getDeliveryDays());
                quotationItemRepository.save(item);
                total = total.add(item.getLineTotal());
            }
            saved.setTotalAmount(total);
            quotationRepository.save(saved);
        }

        return toResponse(saved);
    }

    @Override
    public void deleteQuotation(UUID id, UUID userId) {
        Quotation quotation = quotationRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Quotation not found"));
        quotationItemRepository.deleteByQuotationId(id);
        quotationRepository.delete(quotation);
    }

    @Override
    public QuotationResponse retryProcessing(UUID quotationId) {
        Quotation quotation = quotationRepository.findById(quotationId)
                .orElseThrow(() -> new EntityNotFoundException("Quotation not found"));

        quotation.setStatus(QuotationStatus.QUEUED);
        quotation.setProcessingAttempts(quotation.getProcessingAttempts() + 1);
        quotation.setLastProcessingAt(LocalDateTime.now());
        quotation.setProcessingError(null);

        Quotation saved = quotationRepository.save(quotation);
        return toResponse(saved);
    }

    // ==================================================
    // NEW METHODS: Submit, Cancel, Version, Items
    // ==================================================

    @Override
    public QuotationResponse submitQuotation(UUID quotationId, UUID userId) {
        Quotation quotation = quotationRepository.findById(quotationId)
                .orElseThrow(() -> new EntityNotFoundException("Quotation not found"));

        if (!quotation.getStatus().equals(QuotationStatus.UPLOADED)
                && !quotation.getStatus().equals(QuotationStatus.VALIDATED)
                && !quotation.getStatus().equals(QuotationStatus.NEEDS_REVIEW)) {
            throw new BadRequestException("Quotation in " + quotation.getStatus() + " status cannot be submitted");
        }

        // Validate required fields before submission
        if (quotation.getQuotationDate() == null) {
            throw new BadRequestException("Quotation date is required before submission");
        }

        List<QuotationItem> items = quotationItemRepository.findByQuotationId(quotationId);
        if (items.isEmpty()) {
            throw new BadRequestException("Quotation must have at least one item before submission");
        }

        quotation.setStatus(QuotationStatus.SUBMITTED);
        quotation.setSubmittedBy(userId);
        quotation.setSubmittedAt(LocalDateTime.now());

        Quotation saved = quotationRepository.save(quotation);

        String vendor = vendorRepository.findById(quotation.getVendorId()).map(Vendor::getName).orElse("A vendor");
        String amount = quotation.getTotalAmount() == null ? ""
                : " of " + quotation.getCurrency() + " " + String.format("%,.2f", quotation.getTotalAmount());
        procurementRequestRepository.findById(quotation.getPurchaseRequestId()).ifPresent(pr ->
                notifier.notify(Recipients.roles("PROCUREMENT_ADMIN", "PROCUREMENT_REVIEWER")
                                .andUser(pr.getRequesterId()).except(userId),
                        NotificationType.QUOTATION_RECEIVED, "Quotation received",
                        vendor + " submitted a quotation" + amount + " for \"" + pr.getTitle() + "\".",
                        Notifier.QUOTATION, saved.getId()));
        return toResponse(saved);
    }

    @Override
    public QuotationResponse cancelQuotation(UUID quotationId, UUID userId) {
        Quotation quotation = quotationRepository.findById(quotationId)
                .orElseThrow(() -> new EntityNotFoundException("Quotation not found"));

        if (quotation.getStatus().equals(QuotationStatus.CANCELLED)) {
            throw new BadRequestException("Quotation is already cancelled");
        }
        if (quotation.getStatus().equals(QuotationStatus.VALIDATED)) {
            throw new BadRequestException("Validated quotation cannot be cancelled");
        }

        quotation.setStatus(QuotationStatus.CANCELLED);

        Quotation saved = quotationRepository.save(quotation);
        return toResponse(saved);
    }

    @Override
    public QuotationResponse createNewVersion(UUID quotationId, QuotationRequest request, UUID userId) {
        Quotation original = quotationRepository.findById(quotationId)
                .orElseThrow(() -> new EntityNotFoundException("Quotation not found"));

        int nextVersion = original.getVersion() + 1;

        Quotation newQuotation = new Quotation();
        newQuotation.setPurchaseRequestId(original.getPurchaseRequestId());
        newQuotation.setVendorId(original.getVendorId());
        newQuotation.setStatus(QuotationStatus.UPLOADED);
        newQuotation.setFileName(original.getFileName() + " (v" + nextVersion + ")");
        newQuotation.setFilePath("");
        newQuotation.setVersion(nextVersion);
        newQuotation.setCreatedBy(userId);

        if (request.getQuotationDate() != null) {
            newQuotation.setQuotationDate(LocalDate.parse(request.getQuotationDate()));
        } else {
            newQuotation.setQuotationDate(original.getQuotationDate());
        }
        if (request.getValidUntil() != null) {
            newQuotation.setValidUntil(LocalDate.parse(request.getValidUntil()));
        } else {
            newQuotation.setValidUntil(original.getValidUntil());
        }
        if (request.getSubmissionDeadline() != null) {
            newQuotation.setSubmissionDeadline(LocalDate.parse(request.getSubmissionDeadline()));
        } else {
            newQuotation.setSubmissionDeadline(original.getSubmissionDeadline());
        }
        newQuotation.setCurrency(request.getCurrency() != null ? request.getCurrency() : original.getCurrency());
        newQuotation.setTaxAmount(request.getTaxAmount() != null ? request.getTaxAmount() : original.getTaxAmount());
        newQuotation.setDiscountAmount(request.getDiscountAmount() != null ? request.getDiscountAmount() : original.getDiscountAmount());
        newQuotation.setPaymentTerms(request.getPaymentTerms() != null ? request.getPaymentTerms() : original.getPaymentTerms());
        newQuotation.setDeliveryDays(request.getDeliveryDays() != null ? request.getDeliveryDays() : original.getDeliveryDays());
        newQuotation.setWarrantyPeriod(request.getWarrantyPeriod() != null ? request.getWarrantyPeriod() : original.getWarrantyPeriod());
        newQuotation.setNotes(request.getNotes() != null ? request.getNotes() : original.getNotes());

        Quotation saved = quotationRepository.save(newQuotation);

        if (request.getItems() != null) {
            BigDecimal total = BigDecimal.ZERO;
            for (QuotationItemRequest itemReq : request.getItems()) {
                QuotationItem item = new QuotationItem();
                item.setQuotationId(saved.getId());
                item.setItemName(itemReq.getItemName());
                item.setDescription(itemReq.getDescription());
                item.setQuantity(itemReq.getQuantity());
                item.setUnit(itemReq.getUnit());
                item.setUnitPrice(itemReq.getUnitPrice());
                item.setCurrency(itemReq.getCurrency() != null ? itemReq.getCurrency() : "USD");
                item.setSpecification(itemReq.getSpecification());
                item.setDeliveryDays(itemReq.getDeliveryDays());
                quotationItemRepository.save(item);
                total = total.add(item.getLineTotal());
            }
            saved.setTotalAmount(total);
            quotationRepository.save(saved);
        }

        return toResponse(saved);
    }

    @Override
    public QuotationItemResponse addItem(UUID quotationId, QuotationItemRequest itemRequest, UUID userId) {
        Quotation quotation = quotationRepository.findById(quotationId)
                .orElseThrow(() -> new EntityNotFoundException("Quotation not found"));

        if (quotation.getStatus().equals(QuotationStatus.SUBMITTED)
                || quotation.getStatus().equals(QuotationStatus.VALIDATED)) {
            throw new BadRequestException("Cannot add items to a " + quotation.getStatus() + " quotation");
        }

        QuotationItem item = new QuotationItem();
        item.setQuotationId(quotationId);
        item.setItemName(itemRequest.getItemName());
        item.setDescription(itemRequest.getDescription());
        item.setQuantity(itemRequest.getQuantity());
        item.setUnit(itemRequest.getUnit());
        item.setUnitPrice(itemRequest.getUnitPrice());
        item.setCurrency(itemRequest.getCurrency() != null ? itemRequest.getCurrency() : quotation.getCurrency());
        item.setSpecification(itemRequest.getSpecification());
        item.setDeliveryDays(itemRequest.getDeliveryDays());

        QuotationItem saved = quotationItemRepository.save(item);

        // Recalculate total
        List<QuotationItem> allItems = quotationItemRepository.findByQuotationId(quotationId);
        BigDecimal total = allItems.stream()
                .map(QuotationItem::getLineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        quotation.setTotalAmount(total);
        quotationRepository.save(quotation);

        return toItemResponse(saved);
    }

    @Override
    public QuotationItemResponse updateItem(UUID quotationId, UUID itemId, QuotationItemRequest itemRequest, UUID userId) {
        Quotation quotation = quotationRepository.findById(quotationId)
                .orElseThrow(() -> new EntityNotFoundException("Quotation not found"));

        if (quotation.getStatus().equals(QuotationStatus.SUBMITTED)
                || quotation.getStatus().equals(QuotationStatus.VALIDATED)) {
            throw new BadRequestException("Cannot update items in a " + quotation.getStatus() + " quotation");
        }

        QuotationItem item = quotationItemRepository.findById(itemId)
                .orElseThrow(() -> new EntityNotFoundException("Quotation item not found"));

        if (!item.getQuotationId().equals(quotationId)) {
            throw new BadRequestException("Item does not belong to this quotation");
        }

        item.setItemName(itemRequest.getItemName());
        item.setDescription(itemRequest.getDescription());
        item.setQuantity(itemRequest.getQuantity());
        item.setUnit(itemRequest.getUnit());
        item.setUnitPrice(itemRequest.getUnitPrice());
        item.setCurrency(itemRequest.getCurrency() != null ? itemRequest.getCurrency() : quotation.getCurrency());
        item.setSpecification(itemRequest.getSpecification());
        item.setDeliveryDays(itemRequest.getDeliveryDays());

        QuotationItem saved = quotationItemRepository.save(item);

        // Recalculate total
        List<QuotationItem> allItems = quotationItemRepository.findByQuotationId(quotationId);
        BigDecimal total = allItems.stream()
                .map(QuotationItem::getLineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        quotation.setTotalAmount(total);
        quotationRepository.save(quotation);

        return toItemResponse(saved);
    }

    @Override
    public void deleteItem(UUID quotationId, UUID itemId, UUID userId) {
        Quotation quotation = quotationRepository.findById(quotationId)
                .orElseThrow(() -> new EntityNotFoundException("Quotation not found"));

        if (quotation.getStatus().equals(QuotationStatus.SUBMITTED)
                || quotation.getStatus().equals(QuotationStatus.VALIDATED)) {
            throw new BadRequestException("Cannot delete items from a " + quotation.getStatus() + " quotation");
        }

        QuotationItem item = quotationItemRepository.findById(itemId)
                .orElseThrow(() -> new EntityNotFoundException("Quotation item not found"));

        if (!item.getQuotationId().equals(quotationId)) {
            throw new BadRequestException("Item does not belong to this quotation");
        }

        quotationItemRepository.delete(item);

        // Recalculate total
        List<QuotationItem> allItems = quotationItemRepository.findByQuotationId(quotationId);
        BigDecimal total = allItems.stream()
                .map(QuotationItem::getLineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        quotation.setTotalAmount(total);
        quotationRepository.save(quotation);
    }

    @Override
    @Transactional(readOnly = true)
    public List<QuotationItemResponse> getItems(UUID quotationId) {
        Quotation quotation = quotationRepository.findById(quotationId)
                .orElseThrow(() -> new EntityNotFoundException("Quotation not found"));

        return quotationItemRepository.findByQuotationId(quotationId).stream()
                .map(this::toItemResponse)
                .toList();
    }

    @Override
    public QuotationItemResponse verifyItem(UUID quotationId, UUID itemId, UUID userId) {
        QuotationItem item = quotationItemRepository.findById(itemId)
                .orElseThrow(() -> new EntityNotFoundException("Quotation item not found"));

        if (!item.getQuotationId().equals(quotationId)) {
            throw new BadRequestException("Item does not belong to this quotation");
        }

        item.setManuallyVerified(true);
        item.setVerifiedBy(userId);
        item.setVerifiedAt(LocalDateTime.now());

        QuotationItem saved = quotationItemRepository.save(item);
        return toItemResponse(saved);
    }

    private QuotationResponse toResponse(Quotation quotation) {
        QuotationResponse response = new QuotationResponse();
        response.setId(quotation.getId());
        response.setPurchaseRequestId(quotation.getPurchaseRequestId());
        response.setVendorId(quotation.getVendorId());
        response.setStatus(quotation.getStatus());
        response.setFileName(quotation.getFileName());
        response.setFileSize(quotation.getFileSize());
        response.setContentType(quotation.getContentType());
        response.setQuotationDate(quotation.getQuotationDate());
        response.setValidUntil(quotation.getValidUntil());
        response.setSubmissionDeadline(quotation.getSubmissionDeadline());
        response.setVersion(quotation.getVersion());
        response.setTotalAmount(quotation.getTotalAmount());
        response.setTaxAmount(quotation.getTaxAmount());
        response.setDiscountAmount(quotation.getDiscountAmount());
        response.setPaymentTerms(quotation.getPaymentTerms());
        response.setDeliveryDays(quotation.getDeliveryDays());
        response.setWarrantyPeriod(quotation.getWarrantyPeriod());
        response.setCurrency(quotation.getCurrency());
        response.setNotes(quotation.getNotes());
        response.setExtractionConfidence(quotation.getExtractionConfidence());
        response.setProcessingAttempts(quotation.getProcessingAttempts());
        response.setLastProcessingAt(quotation.getLastProcessingAt());
        response.setProcessingError(quotation.getProcessingError());
        response.setReviewedBy(quotation.getReviewedBy());
        response.setReviewedAt(quotation.getReviewedAt());
        response.setSubmittedBy(quotation.getSubmittedBy());
        response.setSubmittedAt(quotation.getSubmittedAt());
        response.setCreatedBy(quotation.getCreatedBy());
        response.setCreatedAt(quotation.getCreatedAt());
        response.setUpdatedAt(quotation.getUpdatedAt());

        // Load vendor name
        Vendor vendor = vendorRepository.findById(quotation.getVendorId()).orElse(null);
        if (vendor != null) {
            response.setVendorName(vendor.getName());
        }

        // Load items
        List<QuotationItem> items = quotationItemRepository.findByQuotationId(quotation.getId());
        List<QuotationItemResponse> itemResponses = items.stream()
                .map(this::toItemResponse)
                .toList();
        response.setItems(itemResponses);

        return response;
    }

    private QuotationItemResponse toItemResponse(QuotationItem item) {
        QuotationItemResponse resp = new QuotationItemResponse();
        resp.setId(item.getId());
        resp.setQuotationId(item.getQuotationId());
        resp.setItemName(item.getItemName());
        resp.setDescription(item.getDescription());
        resp.setQuantity(item.getQuantity());
        resp.setUnit(item.getUnit());
        resp.setUnitPrice(item.getUnitPrice());
        resp.setLineTotal(item.getLineTotal());
        resp.setCurrency(item.getCurrency());
        resp.setSpecification(item.getSpecification());
        resp.setDeliveryDays(item.getDeliveryDays());
        resp.setConfidenceScore(item.getConfidenceScore());
        resp.setManuallyVerified(item.getManuallyVerified());
        resp.setVerifiedBy(item.getVerifiedBy());
        resp.setVerifiedAt(item.getVerifiedAt());
        resp.setCreatedAt(item.getCreatedAt());
        return resp;
    }
}
