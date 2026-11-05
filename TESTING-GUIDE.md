# VQMS – How to check the whole project

This guide walks through every part of VQMS running in Docker: infrastructure, sign-in for each
role, and the full procurement workflow from request to approval.

## 1. Addresses

| What | URL |
|---|---|
| **Application** | http://localhost:3000 |
| API gateway | http://localhost:8080 |
| Eureka (registered services) | http://localhost:8761 |

Start the stack from the project folder with `docker compose up -d` and check it with
`docker compose ps` (all 16 containers should be "Up"). See
`backend/docker-compose/default/DOCKER-SETUP.md` for setup details.

## 2. Login accounts (Docker database)

All passwords: **`Test@123`**. These are test accounts in the local Docker database only.

| Username | Role | Use it to test |
|---|---|---|
| `admin` | Administrator | Everything, including **Settings** and approval policies |
| `procadmin` | Procurement admin | Vendors, approving requests, comparisons, recommendations, starting approvals, audit, reports |
| `procmanager` | Procurement manager | Approving recommendations (approval level 1), comparisons, reports |
| `reviewer` | Procurement reviewer | Reviewing quotations, viewing vendors and requests |
| `employee` | Employee | Raising and submitting procurement requests, viewing quotations and approvals |
| `vendor` | Vendor | Creating and submitting quotations |
| `dockeremp` | Employee | Spare employee account |

New accounts can be created on the login page (Register) as **Employee** or **Vendor**.

## 3. Infrastructure checks (2 minutes)

1. **Containers** – `docker compose ps`: 15 containers, all "Up".
2. **Eureka** – open http://localhost:8761. "Instances currently registered" lists **11** applications:
   APPROVAL, AUDIT, COMPARISON, DOCUMENT, GATEWAY, NOTIFICATION, QUOTATION, RECOMMENDATION,
   REPORTING, VALIDATION and VENDORQUOTATIONAPPLICATION, all **UP**.
   (Eureka does not list itself; the Python AI extraction service is called by the gateway directly.)
3. **Gateway health** – http://localhost:8080/actuator/health shows `"status":"UP"`.

## 4. Sign-in and role checks (10 minutes)

Sign in with each account and check that the sidebar shows only that role's modules:

| Account | Sidebar should show |
|---|---|
| `employee` | Dashboard, Procurement, Quotations, Comparison, Recommendations, Approvals, Notifications |
| `vendor` | Dashboard, Quotations, Documents, Notifications |
| `procadmin` | All modules except Settings |
| `admin` | All modules including Settings |

Also check: a wrong password shows "Invalid username or password"; opening `/vendors` as
`employee` shows "Access denied"; **Sign out** in the user menu (bottom of the sidebar) returns to login.

## 5. Full workflow test (30 minutes)

Use a separate browser (or a private window) per account so you can stay signed in as several users.

| # | Sign in as | Do this | Expected result |
|---|---|---|---|
| 1 | `procadmin` | **Vendors → Register vendor**: name, email, phone, address → Register | Vendor page opens with status **Active** |
| 2 | `employee` | **Procurement → New request**: title, description, quantity 10, unit pcs, budget 600000, required by a future date, add a line item → **Save draft** | Request page shows **Draft** with the step timeline |
| 3 | `employee` | On the request page → **Submit** → confirm | Status **Submitted**; Approve is *not* offered to the requester |
| 4 | `procadmin` | **Procurement** → open the request → **Approve** (optional comment) | Status **Approved** |
| 5 | `procadmin` | Same page → **Request quotations** | Status **Quotation requested** |
| 6 | `vendor` | **Quotations → New quotation** (manual entry): choose the request and vendor, currency **INR**, quotation date today, add item with unit price → Save → **Submit** | Quotation shows **Submitted**; the total is shown in the header |
| 7 | `employee` | Open the request | The quotation appears under **Quotations**; no edit buttons for the employee |
| 8 | `procadmin` | Request page → **Start evaluation** | Status **Under evaluation** |
| 9 | `procadmin` | **Validation → Run validation** for each quotation | Status **Needs review** (warnings only, e.g. "Tax rate is missing") or **Passed**. Errors = **Failed** |
| 10 | `procadmin` | **Comparison → New comparison**: choose the request, weights e.g. Price 60 / Delivery 40 → create → **Calculate** | Vendors side by side, ranked; "Needs review" flag when a quotation had warnings |
| 11 | `procadmin` | Comparison page → **Complete** | Status **Completed** (locked) |
| 12 | `procadmin` | Comparison page → **Generate recommendation** → **Submit for approval** (tick "I reviewed the flagged points") → **Start approval** | Recommendation **Submitted for approval**; approval **Pending** |
| 13 | `procmanager` | **Approvals → Pending** → **Approve** (amount up to ₹5,00,000) | Approval **Approved**. Above ₹5,00,000 the HIGH_VALUE policy also needs `procadmin` |
| 14 | `procadmin` | Request page → **Complete** | Status **Completed** |

At least **2 eligible quotations** are needed for a comparison (two vendors quoting the same request).
Quotation line names should match the request's item descriptions (e.g. both "Laptop i5 16GB") so items are
compared line by line.

Everywhere along the way, also check:
- **Dashboard** for each role updates its counts (My requests, quotations, waiting for me).
- **Notifications** and **Audit logs** pages open without errors. They stay **empty** in the default
  setup – see Known issues #5.
- **Reports** (`procadmin`) can be generated and exported as CSV.
- **Vendors**: Deactivate / Activate from the list or detail page asks for confirmation.
- Tables: search, status pills, sort menu and pagination on Procurement, Quotations and Vendors.
- Phone size: resize the browser to ~390 px; the sidebar becomes a menu and pages do not scroll sideways.

## 6. Known issues (backend, found while preparing this guide)

1. **Validation warnings are normal for quotations entered in the UI.** The platform stores tax and
   discount per quotation (not per line) and does not record the vendor's own quotation number, so
   validation reports warnings ("Tax rate is missing", "Line tax amount is missing") and returns
   **Needs review**. Such quotations can still be compared; the comparison and recommendation are flagged
   for review and the recommendation can only be submitted after ticking the review acknowledgement.
   Quotations with **errors** (Failed) are excluded. The quotation number shown is the platform reference
   (`Q-` + first 8 characters of the id). To require a clean validation, set
   `COMPARISON_ELIGIBLE_VALIDATION_STATUSES=PASSED` for the comparison and recommendation services.
2. **Vendor accounts get "Access denied" on Notifications and Documents.** Vendor login tokens do not
   contain a `vendorId`, because vendor users are not linked to a vendor company record; the document
   and notification services require it.
3. **Anyone can register with any role** through the register API (including ADMIN); the UI only offers
   Employee and Vendor. The test accounts above were created this way.
4. **Document upload/download** needs S3 (`S3_ENABLED=true`, LocalStack profile) and **AI extraction**
   needs an LLM key (`LLM_ENABLED=true`); both are off by default, so those pages say so.
5. **Audit logs stay empty.** Services keep their audit events in their own outbox tables; nothing
   delivers them to the audit service yet. In-app notifications are delivered (see "Notifications").
6. **First start is slow** (about 9 minutes on an 8 GB laptop); the first page loads after a start can
   take 10 seconds while services warm up.

## 7. Test data already in the Docker database

While preparing this guide the full workflow was run several times. The latest run is complete: request
*"10 laptops for sales"* → 2 quotations (Acme Supplies, Bharat Traders) → comparison **Completed** →
recommendation (Best value) → approval **Approved** → request **Completed**. Earlier runs left requests
in **Under evaluation** that you can continue from step 9.

## Notifications

Notifications are created by the services themselves; nobody has to send them by hand.

| When | Who is notified |
|---|---|
| An employee submits a request | Procurement admins and admins |
| A request is approved or rejected | The requester (the rejection reason is included) |
| Quotations are requested | Every vendor account, plus the requester |
| A vendor submits a quotation | The requester, procurement admins and reviewers |
| A quotation is reviewed | The vendor user who created it |
| An approval workflow starts or moves to the next level | Everyone with that level's approver role |
| An approval is escalated | The escalation role |
| An approval is approved, rejected or cancelled | The requester and the person who submitted it |
| A request is completed | The requester |

How it works:

1. The monolith and the approval service write each notification to an outbox table in the same database transaction as the change.
2. A background relay sends the outbox rows to the Notification Service every few seconds, with retries and back-off.
3. Each notification has a dedupe key, so a retry never creates a duplicate.
4. Notifications are not lost if the Notification Service is down; they are delivered once it is back.

In the UI:

- The bell checks the unread count every 30 seconds and when you come back to the tab.
- When something new arrives, a toast appears.
- The bell dropdown shows the latest notifications.
- Clicking a notification marks it as read and opens the request, quotation or approval.

Quick test:

1. As `employee`, create and submit a request.
2. Within a few seconds, `procadmin` sees "Request awaiting approval".
3. As `procadmin`, approve the request and request quotations.
4. `employee` gets "Request approved" and "Quotations requested".
5. `vendor` gets "New request for quotation".
