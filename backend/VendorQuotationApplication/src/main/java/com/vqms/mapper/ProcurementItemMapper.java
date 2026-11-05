package com.vqms.mapper;

import com.vqms.dto.request.ProcurementItemRequest;
import com.vqms.dto.response.ProcurementItemResponse;
import com.vqms.entity.ProcurementItem;
import com.vqms.entity.ProcurementRequest;

import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class ProcurementItemMapper {

    /**
     * Convert request DTO into a new entity.
     */
    public ProcurementItem toEntity(
            ProcurementItemRequest request,
            ProcurementRequest procurementRequest) {

        ProcurementItem entity = new ProcurementItem();

        entity.setDescription(request.getDescription().trim());
        entity.setQuantity(request.getQuantity());
        entity.setUnit(request.getUnit().trim());
        entity.setExpectedUnitPrice(request.getExpectedUnitPrice());
        entity.setCategory(
                request.getCategory() != null ? request.getCategory().trim() : null
        );
        entity.setSpecification(
                request.getSpecification() != null ? request.getSpecification().trim() : null
        );
        entity.setPriority(
                request.getPriority() != null ? request.getPriority().trim() : null
        );
        entity.setProcurementRequest(procurementRequest);

        return entity;
    }

    /**
     * Convert entity into response DTO.
     */
    public ProcurementItemResponse toResponse(ProcurementItem entity) {

        ProcurementItemResponse response = new ProcurementItemResponse();

        response.setId(entity.getId());
        response.setDescription(entity.getDescription());
        response.setQuantity(entity.getQuantity());
        response.setUnit(entity.getUnit());
        response.setExpectedUnitPrice(entity.getExpectedUnitPrice());
        response.setCategory(entity.getCategory());
        response.setSpecification(entity.getSpecification());
        response.setPriority(entity.getPriority());
        response.setProcurementRequestId(
                entity.getProcurementRequest() != null
                        ? entity.getProcurementRequest().getId()
                        : null
        );
        response.setCreatedAt(entity.getCreatedAt());
        response.setUpdatedAt(entity.getUpdatedAt());

        return response;
    }

    /**
     * Update editable fields only.
     */
    public void updateEntity(
            ProcurementItem entity,
            ProcurementItemRequest request) {

        entity.setDescription(request.getDescription().trim());
        entity.setQuantity(request.getQuantity());
        entity.setUnit(request.getUnit().trim());
        entity.setExpectedUnitPrice(request.getExpectedUnitPrice());
        entity.setCategory(
                request.getCategory() != null ? request.getCategory().trim() : null
        );
        entity.setSpecification(
                request.getSpecification() != null ? request.getSpecification().trim() : null
        );
        entity.setPriority(
                request.getPriority() != null ? request.getPriority().trim() : null
        );
    }

    /**
     * Convert a list of entities into response DTOs.
     */
    public List<ProcurementItemResponse> toResponseList(
            List<ProcurementItem> entities) {

        return entities.stream()
                .map(this::toResponse)
                .toList();
    }
}
