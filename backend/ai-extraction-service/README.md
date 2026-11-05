# VQMS AI Extraction Service

Extracts structured quotation data (vendor, items, quantities, prices, tax/discount rates,
delivery, warranty) from PDF, scanned PDF, image and Excel documents stored in the Document Service.

## Processes

| Process | Command | Port |
|---|---|---|
| API | `uvicorn app.main:app --port 8090` | 8090 (`/docs`, `/metrics`) |
| Migrations | `alembic upgrade head` | – |

## Flow

1. A client calls `POST /api/v1/extractions` (→ 202).
2. A background task in the API process claims the job atomically, sets the document to `PROCESSING`, downloads it via a presigned URL
   (host allow-list, size limit) and verifies the SHA-256 checksum.
3. LangGraph workflow: classification → native text / Excel → OCR (when needed) → normalization →
   LLM structured output (strings only) → Decimal/date parsing → evidence-based confidence → issues.
4. Result stored in `extraction_records` (read it with `GET /api/v1/extractions/{id}`); document set to
   `PROCESSED`/`FAILED`.

## Financial safety

- The LLM only copies printed text. It never computes totals; values are parsed with `Decimal` in code.
- `*_stated` amounts are document values for cross-checking only. The Quotation Service calculates.
- Values whose evidence cannot be found in the document are flagged `UNVERIFIED`; financial issues are `ERROR`
  and force `NEEDS_REVIEW`.

## Security

- All `/api/v1/extractions` endpoints require the VQMS JWT. Read: admins, reviewers, `INTERNAL_SERVICE`.
  Write: admins, `INTERNAL_SERVICE`. Vendors have no access.
- Calls to the Document Service use a short-lived `INTERNAL_SERVICE` token signed with the shared secret.
  Move to OAuth2 client-credentials when the Identity Service supports it.
- Document text is wrapped in random-boundary delimiters; the system prompt forbids following embedded instructions.

## Local setup

```bash
python -m venv .venv && .venv/Scripts/activate      # Windows
pip install -r requirements.txt
cp .env.example .env                                 # fill JWT_SECRET, DATABASE_URL, LLM_* values
alembic upgrade head
uvicorn app.main:app --port 8090
```

Tesseract must be installed for OCR (included in the Docker image).
