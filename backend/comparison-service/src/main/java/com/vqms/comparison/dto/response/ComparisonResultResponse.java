package com.vqms.comparison.dto.response;

import com.vqms.comparison.entity.json.LineComparison;

import java.util.List;

/** Detailed comparison report: header, all vendor results and the item-wise price comparison. */
public record ComparisonResultResponse(
        ComparisonResponse comparison,
        List<VendorComparisonResponse> results,
        List<LineComparison> lineComparisons
) {
}
