package com.vqms.reporting.service.impl;

import com.vqms.reporting.dto.request.ReportRequest;
import com.vqms.reporting.dto.response.PageResponse;
import com.vqms.reporting.dto.response.ReportResponse;
import com.vqms.reporting.entity.Report;
import com.vqms.reporting.enums.ReportStatus;
import com.vqms.reporting.enums.ReportType;
import com.vqms.reporting.exception.ExternalServiceUnavailableException;
import com.vqms.reporting.exception.InvalidReportRequestException;
import com.vqms.reporting.exception.ReportNotFoundException;
import com.vqms.reporting.generator.ReportGenerator;
import com.vqms.reporting.repository.ReportRepository;
import com.vqms.reporting.security.CurrentUserProvider;
import com.vqms.reporting.service.ReportService;
import com.vqms.reporting.util.CsvWriter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Generates a report synchronously (source calls happen outside any DB transaction) and stores
 * an immutable snapshot. A failed generation is stored as FAILED, so attempts remain traceable.
 */
@Service
public class ReportServiceImpl implements ReportService {

    private static final Logger log = LoggerFactory.getLogger(ReportServiceImpl.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final ReportRepository repository;
    private final CurrentUserProvider currentUserProvider;
    private final Map<ReportType, ReportGenerator> generators = new EnumMap<>(ReportType.class);

    public ReportServiceImpl(ReportRepository repository, CurrentUserProvider currentUserProvider,
                             List<ReportGenerator> generators) {
        this.repository = repository;
        this.currentUserProvider = currentUserProvider;
        generators.forEach(g -> this.generators.put(g.type(), g));
    }

    @Override
    public ReportResponse generate(ReportRequest request) {
        UUID userId = currentUserProvider.getCurrentUser().userId();
        ReportGenerator generator = generator(request.type());
        generator.validate(request);

        long started = System.currentTimeMillis();
        Report.ReportBuilder builder = Report.builder()
                .reportNumber(nextNumber()).reportType(request.type()).parameters(parameters(request))
                .generatedBy(userId);
        Report report;
        try {
            ReportGenerator.GeneratedReport result = generator.generate(request);
            report = builder.status(result.warnings().isEmpty() ? ReportStatus.COMPLETED : ReportStatus.PARTIAL)
                    .data(result.data()).warnings(result.warnings()).rowCount(result.rowCount())
                    .durationMs(System.currentTimeMillis() - started).build();
        } catch (ExternalServiceUnavailableException ex) {
            log.warn("Report {} failed: {}", request.type(), ex.getMessage());
            report = builder.status(ReportStatus.FAILED).failureReason(ex.getMessage())
                    .durationMs(System.currentTimeMillis() - started).build();
        }
        Report saved = repository.save(report);
        log.info("Report {} ({}) generated: {} rows, status {}", saved.getReportNumber(), saved.getReportType(),
                saved.getRowCount(), saved.getStatus());
        return toResponse(saved, true);
    }

    @Override
    @Transactional(readOnly = true)
    public ReportResponse get(UUID id) {
        return toResponse(find(id), true);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ReportResponse> list(ReportType type, Pageable pageable) {
        Pageable sorted = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
                Sort.by(Sort.Direction.DESC, "generatedAt"));
        return PageResponse.from(type == null ? repository.findAll(sorted) : repository.findByReportType(type, sorted),
                r -> toResponse(r, false));
    }

    @Override
    @Transactional(readOnly = true)
    public String exportCsv(UUID id) {
        Report report = find(id);
        if (report.getData() == null) {
            throw new InvalidReportRequestException("Report " + report.getReportNumber() + " has no data to export");
        }
        return CsvWriter.write(generator(report.getReportType()).toRows(report.getData()));
    }

    private ReportGenerator generator(ReportType type) {
        ReportGenerator generator = generators.get(type);
        if (generator == null) {
            throw new InvalidReportRequestException("Unsupported report type " + type);
        }
        return generator;
    }

    private Report find(UUID id) {
        return repository.findById(id).orElseThrow(() -> new ReportNotFoundException(id));
    }

    private static Map<String, String> parameters(ReportRequest r) {
        Map<String, String> p = new LinkedHashMap<>();
        if (r.procurementRequestId() != null) {
            p.put("procurementRequestId", r.procurementRequestId().toString());
        }
        if (r.from() != null) {
            p.put("from", r.from().toString());
        }
        if (r.to() != null) {
            p.put("to", r.to().toString());
        }
        if (r.currencyCode() != null) {
            p.put("currencyCode", r.currencyCode());
        }
        return p;
    }

    private String nextNumber() {
        String date = LocalDate.now(ZoneOffset.UTC).format(DateTimeFormatter.BASIC_ISO_DATE);
        for (int attempt = 0; attempt < 5; attempt++) {
            StringBuilder s = new StringBuilder();
            for (int i = 0; i < 6; i++) {
                s.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
            }
            String number = "RPT-" + date + "-" + s;
            if (!repository.existsByReportNumber(number)) {
                return number;
            }
        }
        throw new IllegalStateException("Could not generate a unique report number");
    }

    private static ReportResponse toResponse(Report r, boolean withData) {
        return new ReportResponse(r.getId(), r.getReportNumber(), r.getReportType(), r.getStatus(), r.getParameters(),
                withData ? r.getData() : null, r.getWarnings(), r.getRowCount(), r.getFailureReason(),
                r.getGeneratedBy(), r.getGeneratedAt(), r.getDurationMs());
    }
}
