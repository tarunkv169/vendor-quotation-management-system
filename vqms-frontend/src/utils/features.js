// Feature flags for backend capabilities whose infrastructure may not be present.
// They mirror the backend flags (S3_ENABLED, LLM_ENABLED); keep both sides in sync.
// While a flag is false the UI keeps the read-only pages but hides actions that would fail.

const flag = (value, fallback = false) => (value === undefined || value === '' ? fallback : String(value).toLowerCase() === 'true');

export const FEATURES = {
  documentStorage: flag(import.meta.env.VITE_FEATURE_DOCUMENT_STORAGE), // backend S3_ENABLED
  aiExtraction: flag(import.meta.env.VITE_FEATURE_AI_EXTRACTION), // backend LLM_ENABLED
};

export const FEATURE_MESSAGES = {
  documentStorage: 'Document storage is currently disabled (S3_ENABLED=false). Uploading and downloading files is unavailable, but existing records can still be viewed.',
  aiExtraction: 'AI extraction is currently disabled (LLM_ENABLED=false). Configure an LLM on the AI Extraction Service to enable automatic extraction of quotation data from documents.',
};

// ---- Document storage status at runtime ----
// The flag above comes from the build (VITE_FEATURE_DOCUMENT_STORAGE, set from the backend S3_ENABLED
// in docker-compose). The Document Service has no status endpoint, so when it answers an upload or
// download with "storage disabled" (HTTP 503) the UI also treats storage as off for this session.
const storageListeners = new Set();
let storageDisabledByServer = false;

export function reportStorageError(error) {
  const disabled = error?.status === 503 && /S3_ENABLED|storage is disabled/i.test(String(error?.message || ''));
  if (disabled && !storageDisabledByServer) {
    storageDisabledByServer = true;
    storageListeners.forEach((listener) => listener());
  }
  return disabled;
}

export function subscribeStorageStatus(listener) {
  storageListeners.add(listener);
  return () => storageListeners.delete(listener);
}

export const documentStorageEnabled = () => FEATURES.documentStorage && !storageDisabledByServer;

// ---- AI extraction status at runtime ----
// Build flag VITE_FEATURE_AI_EXTRACTION (set from LLM_ENABLED in docker-compose); the AI Extraction Service
// answers 503 EXTRACTION_DISABLED when no LLM is configured, which also turns the feature off for this session.
const aiListeners = new Set();
let aiDisabledByServer = false;

export function reportExtractionError(error) {
  const disabled = error?.status === 503 && /LLM_ENABLED|extraction is disabled/i.test(String(error?.message || ''));
  if (disabled && !aiDisabledByServer) {
    aiDisabledByServer = true;
    aiListeners.forEach((listener) => listener());
  }
  return disabled;
}

export function subscribeExtractionStatus(listener) {
  aiListeners.add(listener);
  return () => aiListeners.delete(listener);
}

export const aiExtractionEnabled = () => FEATURES.aiExtraction && !aiDisabledByServer;
