package com.vqms.reporting.generator;

import com.fasterxml.jackson.databind.JsonNode;
import com.vqms.reporting.dto.request.ReportRequest;
import com.vqms.reporting.exception.InvalidReportRequestException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;

/** Shared period handling: inclusive dates in UTC, at most 366 days. */
final class PeriodReportSupport {

    private PeriodReportSupport() {
    }

    static void validatePeriod(ReportRequest r, String type) {
        if (r.from() == null || r.to() == null) {
            throw new InvalidReportRequestException("from and to are required for " + type);
        }
        if (r.to().isBefore(r.from())) {
            throw new InvalidReportRequestException("to must not be before from");
        }
        if (ChronoUnit.DAYS.between(r.from(), r.to()) > 366) {
            throw new InvalidReportRequestException("The period may cover at most 366 days");
        }
    }

    /** True when the timestamp field of {@code row} lies within [from 00:00, to+1 00:00) UTC. */
    static boolean inPeriod(JsonNode row, String field, LocalDate from, LocalDate to) {
        String text = row.path(field).asText(null);
        if (text == null) {
            return false;
        }
        try {
            Instant at = Instant.parse(text);
            return !at.isBefore(from.atStartOfDay(ZoneOffset.UTC).toInstant())
                    && at.isBefore(to.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant());
        } catch (DateTimeParseException ex) {
            return false;
        }
    }
}
