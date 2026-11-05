package com.vqms.validation.service.internal;

import com.vqms.validation.client.dto.VendorData;
import com.vqms.validation.dto.internal.IssueDraft;
import com.vqms.validation.dto.internal.ValidationContext;
import com.vqms.validation.dto.request.ExtractionPayload;
import com.vqms.validation.enums.ValidationType;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/** VENDOR_VALIDATION: the vendor exists, is active and matches the vendor named in the document. */
@Service
public class VendorValidationService {

    private static final ValidationType TYPE = ValidationType.VENDOR_VALIDATION;

    public List<IssueDraft> validate(ValidationContext context) {
        List<IssueDraft> issues = new ArrayList<>();
        if (context.quotation().vendorId() == null) {
            return issues; // reported structurally
        }
        Optional<VendorData> vendor = context.vendor();
        if (vendor.isEmpty()) {
            issues.add(IssueDraft.error(TYPE, "VENDOR_NOT_FOUND", "Vendor does not exist", "vendorId")
                    .withValues(null, context.quotation().vendorId()));
            return issues;
        }
        if (!vendor.get().isActive()) {
            issues.add(IssueDraft.error(TYPE, "VENDOR_NOT_ACTIVE", "Vendor is not active", "vendorId")
                    .withValues("ACTIVE", vendor.get().status()));
        }

        String documentVendorName = context.extraction()
                .map(ExtractionPayload::quotation)
                .map(ExtractionPayload.ExtractedQuotation::vendor)
                .map(ExtractionPayload.Vendor::name)
                .map(ExtractionPayload.Field::text)
                .orElse(null);
        if (documentVendorName != null && vendor.get().name() != null
                && !namesMatch(documentVendorName, vendor.get().name())) {
            issues.add(IssueDraft.warning(TYPE, "VENDOR_NAME_MISMATCH",
                    "Vendor name in the document differs from the registered vendor", "vendor.name")
                    .withValues(vendor.get().name(), documentVendorName));
        }
        return issues;
    }

    /** Lenient match: case/punctuation-insensitive containment ("Acme Pvt. Ltd" vs "ACME PVT LTD"). */
    static boolean namesMatch(String a, String b) {
        String x = normalize(a);
        String y = normalize(b);
        return !x.isEmpty() && !y.isEmpty() && (x.contains(y) || y.contains(x));
    }

    private static String normalize(String value) {
        return value.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]", "");
    }
}
