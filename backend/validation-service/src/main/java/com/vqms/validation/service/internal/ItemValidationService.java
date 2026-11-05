package com.vqms.validation.service.internal;

import com.vqms.validation.client.dto.ProcurementRequestData;
import com.vqms.validation.client.dto.QuotationItemData;
import com.vqms.validation.dto.internal.IssueDraft;
import com.vqms.validation.dto.internal.ValidationContext;
import com.vqms.validation.enums.ValidationType;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * ITEM_VALIDATION against the procurement request: every line references a requested item,
 * units match, quantities match the requested quantity, and no requested item is left unquoted.
 */
@Service
public class ItemValidationService {

    private static final ValidationType TYPE = ValidationType.ITEM_VALIDATION;

    public List<IssueDraft> validate(ValidationContext context) {
        List<IssueDraft> issues = new ArrayList<>();
        if (context.procurementRequest().isEmpty()) {
            return issues; // reported by procurement validation
        }
        List<ProcurementRequestData.Item> requestedItems = context.procurementRequest().get().safeItems();
        Map<UUID, ProcurementRequestData.Item> requested = requestedItems.stream()
                .filter(item -> item.id() != null)
                .collect(Collectors.toMap(ProcurementRequestData.Item::id, Function.identity(), (a, b) -> a));

        Set<UUID> quoted = new HashSet<>();
        List<QuotationItemData> items = context.quotation().safeItems();
        for (int i = 0; i < items.size(); i++) {
            QuotationItemData item = items.get(i);
            String path = "items[" + i + "]";
            // Lines without a reference (quotations entered in the platform UI) are linked by item name.
            UUID itemId = item.procurementItemId() != null ? item.procurementItemId() : matchByName(item, requestedItems);
            if (itemId == null) {
                if (!requested.isEmpty()) {
                    issues.add(IssueDraft.warning(TYPE, "ITEM_REFERENCE_MISSING",
                            "Line is not linked to a procurement item", path + ".procurementItemId"));
                }
                continue;
            }
            if (!quoted.add(itemId)) {
                issues.add(IssueDraft.warning(TYPE, "DUPLICATE_ITEM_LINE",
                        "Procurement item is quoted more than once", path + ".procurementItemId"));
            }
            ProcurementRequestData.Item reference = requested.get(itemId);
            if (reference == null) {
                issues.add(IssueDraft.error(TYPE, "ITEM_NOT_IN_REQUEST",
                        "Line references an item that is not part of the procurement request",
                        path + ".procurementItemId").withValues(null, itemId));
                continue;
            }
            if (reference.unit() != null && item.unit() != null
                    && !reference.unit().trim().equalsIgnoreCase(item.unit().trim())) {
                issues.add(IssueDraft.warning(TYPE, "UNIT_MISMATCH", "Unit differs from the requested unit",
                        path + ".unit").withValues(reference.unit(), item.unit()));
            }
            BigDecimal requestedQty = reference.quantity();
            if (requestedQty != null && item.quantity() != null && item.quantity().signum() > 0) {
                int cmp = item.quantity().compareTo(requestedQty);
                if (cmp < 0) {
                    issues.add(IssueDraft.warning(TYPE, "PARTIAL_QUANTITY", "Quoted quantity is below the requested quantity",
                            path + ".quantity").withValues(requestedQty.toPlainString(), item.quantity().toPlainString()));
                } else if (cmp > 0) {
                    issues.add(IssueDraft.warning(TYPE, "QUANTITY_EXCEEDS_REQUEST",
                            "Quoted quantity exceeds the requested quantity", path + ".quantity")
                            .withValues(requestedQty.toPlainString(), item.quantity().toPlainString()));
                }
            }
        }

        for (ProcurementRequestData.Item item : requestedItems) {
            if (item.id() != null && !quoted.contains(item.id())) {
                issues.add(IssueDraft.warning(TYPE, "ITEM_NOT_QUOTED",
                        "Requested item '" + item.description() + "' is not quoted", "items")
                        .withValues(item.id(), null));
            }
        }
        return issues;
    }

    /** Requested item whose description equals the line's item name (ignoring case and spacing), if exactly one. */
    private static UUID matchByName(QuotationItemData line, List<ProcurementRequestData.Item> requestedItems) {
        String name = normalize(line.itemName());
        if (name == null) {
            return null;
        }
        List<UUID> matches = requestedItems.stream()
                .filter(item -> item.id() != null && name.equals(normalize(item.description())))
                .map(ProcurementRequestData.Item::id)
                .toList();
        return matches.size() == 1 ? matches.get(0) : null;
    }

    private static String normalize(String text) {
        return text == null || text.isBlank() ? null : text.trim().replaceAll("\\s+", " ").toLowerCase();
    }
}
