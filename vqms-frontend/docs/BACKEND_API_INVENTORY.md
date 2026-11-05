# VQMS — Backend API Inventory (frontend integration reference)

Source: inspection of the backend code on 2026-11-03 (controllers, DTOs, enums, security, gateway routes)
plus live calls through the running gateway. **The gateway route table decides which implementation
the browser reaches** — several paths exist in both the monolith and a microservice.

## 1. Runtime topology

| Component | Local port | Reached by the frontend? |
|---|---|---|
| API Gateway (Spring Cloud Gateway, JWT + CORS at the edge) | 8080 (18080 locally because 8080 is taken) | **Yes — the only entry point** |
| Monolith `VendorQuotationApplication` (Identity, Vendor, Procurement, Settings, Quotations-v1) | 8081 / 18081 | via gateway |
| document-service | 8083 | via gateway |
| ai-extraction-service (FastAPI) | 8090 | via gateway |
| validation-service | 8084 | via gateway |
| comparison-service | 8085 | via gateway |
| recommendation-service | 8086 | via gateway |
| approval-service | 8087 | via gateway |
| audit-service | 8088 / 18088 | via gateway |
| notification-service | 8089 | via gateway |
| reporting-service | 8091 | via gateway |
| quotation-service | 8082 | **No gateway route** (see §6, blocker B1) |
| eureka | 8761 | no |

Gateway routes (`gateway-service/src/main/resources/application.yml`):

| Path prefix | Target |
|---|---|
| `/api/v1/auth/**`, `/vendors/**`, `/procurement-requests/**`, `/settings/**`, `/quotations/**` | monolith |
| `/api/v1/documents/**` | document-service |
| `/api/v1/extractions/**` | ai-extraction-service |
| `/api/v1/validations/**` | validation-service |
| `/api/v1/comparisons/**` | comparison-service |
| `/api/v1/recommendations/**` | recommendation-service |
| `/api/v1/approvals/**`, `/api/v1/approval-policies/**` | approval-service |
| `/api/v1/audit/**` | audit-service |
| `/api/v1/notifications/**` | notification-service |
| `/api/v1/reports/**` | reporting-service |

Public paths (no token): `POST /api/v1/auth/login`, `POST /api/v1/auth/register`.
Everything else needs `Authorization: Bearer <jwt>`; the gateway answers 401 otherwise.
The monolith's own approval/audit/comparison/notification/recommendation/report controllers are
**shadowed by the gateway** and must not be used by the frontend.

## 2. Authentication and roles

- Login: `POST /api/v1/auth/login` `{username, password}` → `AuthResponse {token, type:"Bearer", userId, username, role}`.
- Register: `POST /api/v1/auth/register` `{username(3-100), email, password(6-100), fullName(≤150), role?}` → 201 `AuthResponse`.
- JWT: HS512, 24 h expiry, claims `sub`=username, `role`, `userId`. **No refresh token, no logout endpoint,
  no forgot/reset password.** Logout = discard token client-side. On 401 → back to login.
- `GET /api/v1/auth/me` and `PATCH /api/v1/auth/profile` require header **`X-User-Id: <userId>`** (not read from the token).
- Token storage: the backend uses a bearer token (no cookies) → keep it in memory + `localStorage`.

Roles used by backend `@PreAuthorize` / checks (role claim → `ROLE_<role>`):

| Role | Where it is used |
|---|---|
| `ADMIN` | everywhere (super-user) |
| `PROCUREMENT_ADMIN` | procurement approve/reject, documents, validations, comparisons, recommendations, approvals, audit, reports |
| `PROCUREMENT_MANAGER` | comparisons, recommendations, approvals, approval-policies (read), reports |
| `PROCUREMENT_REVIEWER` | quotation-service review (only) |
| `EMPLOYEE` | own procurement requests; read comparisons/recommendations/approvals |
| `VENDOR` | document upload/delete; quotation-service create/submit |
| `INTERNAL_SERVICE` | service-to-service only — never a UI role |

No `PATHOLOGIST` role exists. The register endpoint accepts any role string (backend weakness, §6 B4);
the UI will only offer `EMPLOYEE` and `VENDOR` on self-registration.

## 3. Response conventions (differ per service)

| Service group | Page format | Error format |
|---|---|---|
| Monolith | Spring `Page`: `{content, number, size, totalElements, totalPages, first, last, ...}`; params `page`, `size`, `sortBy`, `direction` (`asc`/`desc`) | `{status, message, timestamp, errors: {field: msg} \| null}` |
| Microservices (Java) | `PageResponse {content, page, size, totalElements, totalPages, first, last}`; params `page`, `size`, `sort=field,dir` | `{timestamp, status, error, message, path, correlationId, validationErrors}` |
| ai-extraction-service | lists are plain arrays | same shape as microservices (camelCase) |
| Monolith `GET /quotations` | plain array | — |

Microservice timestamps are ISO `Instant` (UTC, `Z`); monolith uses `LocalDateTime` (no zone).

## 4. Endpoint inventory (as reached through the gateway)

### Identity (monolith) — `/api/v1/auth`
| Method | Path | Notes |
|---|---|---|
| POST | `/login` | public |
| POST | `/register` | public |
| GET | `/me` | header `X-User-Id` → `UserResponse {id, username, email, fullName, role, status, lastLoginAt, createdAt}` |
| PATCH | `/profile` | header `X-User-Id`; `{username?, email?, fullName?, newPassword?}` |
| GET | `/users?page&size` | Page<UserResponse> (no role check in backend) |
| GET / PUT | `/users/{id}` | PUT body = RegisterRequest |
| PATCH | `/users/{id}/deactivate` | 204 |

### Vendors (monolith) — `/api/v1/vendors`
`VendorRequest {name*, email*, phone?, address?}` → `VendorResponse {id, name, email, phone, address, status, createdAt, updatedAt}`; status `ACTIVE`/`INACTIVE`.

| Method | Path | Notes |
|---|---|---|
| POST | `` | create |
| GET | `?page&size&sortBy&direction` | Page; sortBy whitelist incl. `name`; size 1-100 |
| GET | `/page`, `/search?keyword`, `/status/{status}` | Page |
| GET / PUT / DELETE | `/{id}` | |
| PATCH | `/{id}/activate`, `/{id}/deactivate` | |
| GET | `/{id}/active` | boolean |

### Procurement (monolith) — `/api/v1/procurement-requests`
Status: `DRAFT, SUBMITTED, QUOTATION_REQUESTED, UNDER_EVALUATION, APPROVED, REJECTED, CANCELLED, COMPLETED`.
Create/update body: `{title*, description*, quantity*≥1, unit*, requiredBy* (future LocalDateTime), budget?, items?[]}`;
item: `{description*(3-200), quantity*≥1, unit*(2-50), expectedUnitPrice*, category?, specification?, priority?}`.
Response: `{id, title, description, quantity, unit, status, requiredBy, budget, items[], requesterId, approverId, approvalComment, rejectionReason, submittedAt, approvedAt, rejectedAt, cancelledAt, createdAt, updatedAt}`.

| Method | Path | Who |
|---|---|---|
| POST | `` | any authenticated (requester = token user) |
| GET | `` (all), `/search?keyword`, `/status/{status}` | ADMIN / PROCUREMENT_ADMIN |
| GET | `/my-requests`, `/my-requests/search`, `/my-requests/status/{status}`, `/my-approvals` | own |
| GET / PUT / DELETE | `/{id}` | owner or admin |
| PATCH | `/{id}/submit`, `/{id}/cancel` | owner |
| PATCH | `/{id}/approve?comment`, `/{id}/reject?reason*` | admin |
| PATCH | `/{id}/request-quotations`, `/{id}/start-evaluation`, `/{id}/complete` | admin |
| POST/GET/PUT/DELETE | `/{id}/items`, `/{id}/items/{itemId}` | |

### Quotations v1 (monolith) — `/api/v1/quotations` (current gateway target)
Status: `UPLOADED, QUEUED, PROCESSING, EXTRACTED, NEEDS_REVIEW, VALIDATED, FAILED, REJECTED, SUBMITTED, CANCELLED`.
Create: `POST /manual` `{purchaseRequestId*, vendorId*, quotationDate*, validUntil?, submissionDeadline?, currency, taxAmount?, discountAmount?, paymentTerms?, deliveryDays?, warrantyPeriod?, notes?, items[] {itemName*, description?, quantity*, unit*, unitPrice*, currency, specification?, deliveryDays?}}`.
Also: `POST /{requestId}/upload` (multipart), `GET ''` (array), `GET /{id}`, `GET /request/{id}`, `GET /vendor/{id}`, `PUT/DELETE /{id}`,
`POST /{id}/process|review|submit|cancel|retry|version`, items CRUD, `POST /{qid}/items/{iid}/verify`.
No accept / reject / withdraw actions.

### Quotations v2 (quotation-service) — **not routed** (B1)
Status `DRAFT, SUBMITTED, UNDER_REVIEW, ACCEPTED, REJECTED, WITHDRAWN, EXPIRED`; request `{procurementRequestId, vendorId, currencyCode, issueDate, validUntil, notes, termsAndConditions}`, items with `taxRate`, `discountRate`, `warrantyMonths`; endpoints create, `/my-quotations`, `/procurement-request/{id}`, `/status/{s}`, submit/review/accept/reject/withdraw. This is the model that document/validation/comparison/recommendation services read.

### Documents — `/api/v1/documents`
Types `QUOTATION_PDF, QUOTATION_EXCEL, VENDOR_CERTIFICATE, SUPPORTING_DOCUMENT, PROCUREMENT_ATTACHMENT`; status `UPLOADING, PENDING_SCAN, ACTIVE, PROCESSING, PROCESSED, FAILED, UPLOAD_FAILED, QUARANTINED, DELETED`.
Upload: `POST /upload` multipart `file` + fields `documentType, quotationId?, vendorId?, procurementRequestId?, description?` (VENDOR/ADMIN/PROCUREMENT_ADMIN; ≤20 MB; pdf,xlsx,png,jpg,jpeg).
Read: `GET ''?documentType&status&quotationId&vendorId&procurementRequestId&page&size`, `/{id}`, `/{id}/history`, `/quotation/{id}`, `/vendor/{id}`, `/procurement-request/{id}`.
Download: `GET /{id}/download` → `{downloadUrl (pre-signed, 5 min), expiresAt, ...}`. `DELETE /{id}`; `PATCH /{id}/status` (admin).

### AI Extraction — `/api/v1/extractions`
`POST ''` `{documentId, force?}` → 202 `{extractionId, documentId, status, statusUrl, duplicate}`;
`GET /{id}` (status, attempt, documentFormat, result, confidence, issues…); `GET /document/{documentId}` (array);
`POST /{id}/retry` → 202. **No list/history-of-all endpoint.**

### Validation — `/api/v1/validations`
Status `PENDING, IN_PROGRESS, PASSED, FAILED, NEEDS_REVIEW`; severity `ERROR, WARNING, INFO`.
`POST ''` `{quotationId, extractionId?, documentId?, extraction?}` (admin roles); `GET ''?procurementRequestId&vendorId&status`; `/{id}`; `/quotation/{id}`; `/status/{s}`; `POST /{id}/revalidate`.
Response includes expected subtotal/discount/tax/total, quotedTotal, error/warning/info counts, `issues[]`.

### Comparison — `/api/v1/comparisons`
Status `CREATED, CALCULATED, COMPLETED, FAILED`; criteria `PRICE, DELIVERY_TIME, WARRANTY, TECHNICAL_COMPLIANCE, QUALITY, COMMERCIAL_TERMS`.
`POST ''` `{procurementRequestId*, criteria*[{criterion, weight, minimumScore?}] (≤6), quotationIds?, currencyCode?, requireAllItems, manualScores?}`;
`GET ''?status&procurementRequestId`; `/{id}`; `/procurement-request/{id}`; `POST /{id}/calculate`; `GET /{id}/results` (results + lineComparisons); `GET /{id}/ranking`; `POST /{id}/complete`.

### Recommendation — `/api/v1/recommendations`
Status `GENERATED, NEEDS_REVIEW, SUBMITTED_FOR_APPROVAL, SUPERSEDED`; type `BEST_VALUE, SINGLE_ELIGIBLE_VENDOR, NO_QUALIFYING_VENDOR`; risk `LOW..CRITICAL`; vendor role `PRIMARY, ALTERNATIVE, NOT_RECOMMENDED`.
`POST ''` `{comparisonId, policyCode?, criteria?[]}`; `GET ''?status&procurementRequestId`; `/{id}`; `/procurement-request/{id}`; `POST /{id}/regenerate`; `GET /{id}/ranking`; `GET /{id}/explanation`; `POST /{id}/submit-for-approval` `{comment, reviewAcknowledged}`.

### Approval — `/api/v1/approvals`, `/api/v1/approval-policies`
Status `PENDING, IN_PROGRESS, APPROVED, REJECTED, CANCELLED`; steps `WAITING, PENDING, APPROVED, REJECTED, CANCELLED`.
`POST ''` `{recommendationId}`; `GET ''?status&procurementRequestId`; `/{id}`; `GET /pending` (current user's queue, array);
`POST /{id}/approve|reject` `{comment}`; `/{id}/escalate`, `/{id}/cancel` (admin); `GET /{id}/history`;
delegations: `POST /delegations` `{delegateId, validFrom, validUntil, reason}`, `GET /delegations/my`, `DELETE /delegations/{id}`.
Policies: `GET ''` (array), `/{id}`; ADMIN: `POST`, `PUT /{id}`, `PATCH /{id}/deactivate`.

### Notifications — `/api/v1/notifications`
Category `APPROVAL_REQUIRED, APPROVAL_COMPLETED, APPROVAL_REJECTED, APPROVAL_ESCALATED, VALIDATION_ATTENTION, QUOTATION_UPDATE, SYSTEM`; priority `LOW, NORMAL, HIGH`; email `NOT_REQUESTED, PENDING, SENT, FAILED`.
`GET /my?unreadOnly&page&size`; `GET /my/unread-count` → `{unreadCount}`; `GET /{id}`; `PATCH /{id}/read`; `PATCH /my/read-all`; `POST ''` (admin/system send).
**No preferences API.**

### Audit — `/api/v1/audit` (ADMIN, PROCUREMENT_ADMIN; read-only)
`GET /events?actorId&aggregateType&aggregateId&eventType&sourceService&from&to&page&size(50)`; `GET /events/{id}`;
`GET /aggregates/{type}/{id}` (entity timeline); `GET /verify` (ADMIN, hash-chain check).
Event: `{id, sequenceNumber, sourceService, eventType, aggregateType, aggregateId, actorId, actorRole, outcome, description, correlationId, payload (JSON string), occurredAt, recordedAt, hash}`.

### Reporting — `/api/v1/reports` (ADMIN, PROCUREMENT_ADMIN, PROCUREMENT_MANAGER)
Types `PROCUREMENT_SUMMARY, APPROVAL_SPEND, VALIDATION_QUALITY`; status `COMPLETED, PARTIAL, FAILED`.
`POST ''` `{type*, procurementRequestId?, from?, to?, currencyCode?}` → synchronous `ReportResponse {…, data (JSON), warnings, rowCount}`;
`GET ''?type`; `GET /{id}`; `GET /{id}/export` → **CSV only**.

### Settings (monolith) — `/api/v1/settings`
`GET ''?page&size`, `GET/PUT/DELETE /{key}`, `POST ''`.

## 5. Missing / unavailable APIs (frontend shows "pending integration")
1. Forgot / reset password, refresh token, server logout.
2. Notification preferences.
3. Extraction history across all documents (only per document).
4. Report PDF / Excel export and asynchronous report jobs (reports are synchronous, CSV export only).
5. Dashboard KPI endpoint reachable through the gateway (monolith `/reports/dashboard` is shadowed) —
   KPIs are built from `totalElements` of existing list endpoints and generated reports.
6. Vendor "verification" workflow (only activate/deactivate exists).
7. Quotation accept/reject/withdraw in the routed (monolith) quotation API.
8. Department filters (no department field anywhere).
9. Global search across modules.

## 6. Integration blockers / backend observations (no backend changes made)
- **B1 — two quotation implementations.** Gateway sends `/api/v1/quotations/**` to the monolith, but the
  document, validation, comparison and recommendation services read quotations from **quotation-service**.
  Quotations created through the gateway are invisible to the downstream pipeline. Decision needed before Module 4.
- **B2 — vendor identity.** The JWT has no `vendorId` claim and users are not linked to vendor records;
  document-service ownership checks and quotation-service `/my-quotations` rely on it.
- **B3 — `/auth/me` and `/auth/profile`** trust a client-supplied `X-User-Id` header.
- **B4 — self-registration accepts any role**, including `ADMIN`.
- **B5 — document storage** needs S3/LocalStack; not running locally → uploads fail until started.
- **B6 — AI extraction** needs `LLM_MODEL` / `LLM_API_KEY`.
- **B7 — comparison "Calculate" returns 503** ("Quotation Service is currently unavailable"): the comparison
  service reads quotations from quotation-service, which rejects the call (it does not accept the shared JWT
  and holds no gateway quotations). Same root cause as B1; confirmed on 2026-11-03.
- **B8 — procurement approval**: the requester cannot approve their own request (backend rule); the UI hides
  Approve/Reject for the owner.
- **B9 — period reports** (`APPROVAL_SPEND`, `VALIDATION_QUALITY`) require `from` and `to`, at most 366 days apart.

## 7. Frontend integration architecture
- One Axios instance, `baseURL` = `VITE_API_GATEWAY_URL` (empty in dev → Vite proxy `/api` → gateway).
- Request interceptor: `Authorization: Bearer`, `X-Correlation-Id` (uuid), `X-User-Id` only for `/auth/me|profile`.
- Response interceptor: normalises both error formats to `{status, message, fieldErrors, correlationId}`; 401 → logout.
- `utils/pagination.js` normalises Spring `Page` and `PageResponse` to `{items, page, size, totalElements, totalPages}`.
- One service module per backend service under `src/features/<module>/<module>Service.js`; components never call Axios directly.
- TanStack Query for server state (dedupe, cache, cancellation); Context for auth session.
- Role → module permissions in `utils/permissions.js`, mirrored from §2; backend remains authoritative.
