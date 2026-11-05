import axios from 'axios';

// The backend has two error formats:
//   monolith:      { status, message, timestamp, errors: { field: message } }
//   microservices: { timestamp, status, error, message, path, correlationId, validationErrors }
// Both are normalised into ApiError so components never parse raw responses.

const DEFAULT_MESSAGES = {
  0: 'Cannot reach the server. Check your connection and try again.',
  400: 'The request contains invalid data.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested record was not found.',
  405: 'This operation is not supported.',
  409: 'The record was changed by someone else or conflicts with its current state.',
  413: 'The file is too large.',
  422: 'The request could not be processed.',
  429: 'Too many requests. Please wait a moment.',
  500: 'An unexpected server error occurred. Please try again later.',
  502: 'A backend service is unavailable. Please try again later.',
  503: 'A backend service is unavailable. Please try again later.',
  504: 'The server took too long to respond.',
};

export class ApiError extends Error {
  constructor({ status, message, fieldErrors, correlationId }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors || {};
    this.correlationId = correlationId || null;
  }

  get isNetworkError() {
    return this.status === 0;
  }
}

function defaultMessage(status) {
  if (DEFAULT_MESSAGES[status]) return DEFAULT_MESSAGES[status];
  return status >= 500 ? DEFAULT_MESSAGES[500] : DEFAULT_MESSAGES[400];
}

export function normalizeError(error) {
  if (error instanceof ApiError) return error;

  if (!axios.isAxiosError(error)) {
    return new ApiError({ status: -1, message: error?.message || 'Unexpected error' });
  }

  if (!error.response) {
    const timeout = error.code === 'ECONNABORTED';
    return new ApiError({ status: 0, message: timeout ? DEFAULT_MESSAGES[504] : DEFAULT_MESSAGES[0] });
  }

  const { status, data, headers } = error.response;
  const body = data && typeof data === 'object' ? data : {};
  const fieldErrors = body.validationErrors || body.errors || {};
  const correlationId = body.correlationId || headers?.['x-correlation-id'] || null;

  // Server messages are already sanitised by every GlobalExceptionHandler, but 5xx texts are
  // never shown verbatim so internal details cannot leak into the UI.
  let message = defaultMessage(status);
  if (status < 500 && typeof body.message === 'string' && body.message.trim()) {
    message = body.message;
  }
  if (status === 400 && Object.keys(fieldErrors).length > 0 && message === 'Validation failed') {
    message = 'Please correct the highlighted fields.';
  }

  return new ApiError({ status, message, fieldErrors, correlationId });
}

// Copies backend field errors into react-hook-form.
export function applyFieldErrors(error, setError) {
  if (!(error instanceof ApiError)) return false;
  const entries = Object.entries(error.fieldErrors || {});
  entries.forEach(([field, message]) => setError(field, { type: 'server', message }));
  return entries.length > 0;
}
