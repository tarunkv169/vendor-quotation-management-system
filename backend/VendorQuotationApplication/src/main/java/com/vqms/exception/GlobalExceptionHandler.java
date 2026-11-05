
package com.vqms.exception;

import com.vqms.dto.response.ApiErrorResponse;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    // ==========================================
    // ILLEGAL ARGUMENT EXCEPTION
    // ==========================================

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiErrorResponse> handleIllegalArgumentException(
            IllegalArgumentException exception) {

        return buildErrorResponse(
                HttpStatus.BAD_REQUEST,
                exception.getMessage(),
                null
        );
    }

    // ==========================================
    // DUPLICATE VENDOR EMAIL
    // ==========================================

    @ExceptionHandler(DuplicateVendorEmailException.class)
    public ResponseEntity<ApiErrorResponse> handleDuplicateVendorEmail(
            DuplicateVendorEmailException exception) {

        return buildErrorResponse(
                HttpStatus.CONFLICT,
                exception.getMessage(),
                null
        );
    }

    // ==========================================
    // VALIDATION ERRORS
    // ==========================================

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidationErrors(
            MethodArgumentNotValidException exception) {

        Map<String, String> fieldErrors =
                exception.getBindingResult()
                        .getFieldErrors()
                        .stream()
                        .collect(Collectors.toMap(
                                error -> error.getField(),
                                error -> error.getDefaultMessage() != null
                                        ? error.getDefaultMessage()
                                        : "Invalid value",
                                (existing, replacement) -> existing
                        ));

        return buildErrorResponse(
                HttpStatus.BAD_REQUEST,
                "Validation failed",
                fieldErrors
        );
    }

    // ==========================================
    // MALFORMED JSON
    // ==========================================

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> handleMalformedJson(
            HttpMessageNotReadableException exception) {

        return buildErrorResponse(
                HttpStatus.BAD_REQUEST,
                "Malformed JSON request. Please check your request body.",
                null
        );
    }

    // ==========================================
    // VENDOR NOT FOUND
    // ==========================================

    @ExceptionHandler(VendorNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleVendorNotFound(
            VendorNotFoundException exception) {

        return buildErrorResponse(
                HttpStatus.NOT_FOUND,
                exception.getMessage(),
                null
        );
    }

    // ==========================================
    // PROCUREMENT REQUEST NOT FOUND
    // ==========================================

    @ExceptionHandler(ProcurementRequestNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleProcurementRequestNotFound(
            ProcurementRequestNotFoundException exception) {

        return buildErrorResponse(
                HttpStatus.NOT_FOUND,
                exception.getMessage(),
                null
        );
    }

    // ==========================================
    // BAD REQUEST
    // ==========================================

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<ApiErrorResponse> handleBadRequest(
            BadRequestException exception) {

        return buildErrorResponse(
                HttpStatus.BAD_REQUEST,
                exception.getMessage(),
                null
        );
    }

    // ==========================================
    // ACCESS DENIED
    // ==========================================

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> handleAccessDenied(
            AccessDeniedException exception) {

        return buildErrorResponse(
                HttpStatus.FORBIDDEN,
                "You do not have permission to perform this operation.",
                null
        );
    }

    // ==========================================
    // INTERNAL SERVER ERROR
    // ==========================================

    @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleNoResource(Exception exception) {
        return buildErrorResponse(HttpStatus.NOT_FOUND, "Resource not found", null);
    }

    @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiErrorResponse> handleTypeMismatch(Exception exception) {
        return buildErrorResponse(HttpStatus.BAD_REQUEST, "Invalid value in request path or parameters", null);
    }

    @ExceptionHandler(org.springframework.web.HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiErrorResponse> handleMethodNotSupported(Exception exception) {
        return buildErrorResponse(HttpStatus.METHOD_NOT_ALLOWED, "HTTP method not supported for this path", null);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleGlobalException(
            Exception exception) {

        // Log the actual exception on the server.
        exception.printStackTrace();

        return buildErrorResponse(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "An unexpected internal server error occurred.",
                null
        );
    }

    // ==========================================
    // COMMON ERROR RESPONSE BUILDER
    // ==========================================

    private ResponseEntity<ApiErrorResponse> buildErrorResponse(
            HttpStatus status,
            String message,
            Map<String, String> errors) {

        ApiErrorResponse errorResponse = new ApiErrorResponse(
                status.value(),
                message,
                LocalDateTime.now(),
                errors
        );

        return ResponseEntity
                .status(status)
                .body(errorResponse);
    }
}
