// Feature flags for backend capabilities whose infrastructure may not be present.
// They mirror the backend flags (S3_ENABLED, LLM_ENABLED); keep both sides in sync.
// While a flag is false the UI keeps the read-only pages but hides actions that would fail.

const flag = (value, fallback = false) => (value === undefined || value === '' ? fallback : String(value).toLowerCase() === 'true');

export const FEATURES = {
  documentStorage: flag(import.meta.env.VITE_FEATURE_DOCUMENT_STORAGE), // backend S3_ENABLED
  aiExtraction: flag(import.meta.env.VITE_FEATURE_AI_EXTRACTION), // backend LLM_ENABLED
};

export const FEATURE_MESSAGES = {
  documentStorage: 'Document storage is switched off (S3_ENABLED=false). Uploading and downloading files is unavailable; existing records can still be viewed.',
  aiExtraction: 'AI extraction is switched off (LLM_ENABLED=false). Configure an LLM on the AI Extraction Service to extract quotation data.',
};
