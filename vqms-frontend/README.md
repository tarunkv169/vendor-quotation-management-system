# VQMS Frontend

React 19 + Vite + Tailwind CSS 4 web client for the Vendor Quotation Management System.
All data comes from the backend through the API Gateway — no mock data.

## Run locally

```bash
npm install
cp .env.example .env.local      # optional; defaults work with backend/run-local.ps1
npm run dev                     # http://localhost:5173
```

The dev server proxies `/api` to `VITE_DEV_PROXY_TARGET` (default `http://localhost:18080`, the gateway
port chosen by `backend/run-local.ps1` when 8080 is taken). Start the backend first:
`backend/run-local.ps1 start`.

| Script | Purpose |
|---|---|
| `npm run dev` | dev server with hot reload |
| `npm run build` | production build into `dist/` |
| `npm run preview` | serve the production build |
| `npm run lint` | ESLint |

## Docker

```bash
docker build -t vqms-frontend .
docker run -p 3000:80 -e API_GATEWAY_URL=http://host.docker.internal:18080 vqms-frontend
```

nginx serves the build and forwards `/api/` to `API_GATEWAY_URL` (default `http://gateway-service:8080`
inside docker-compose).

## Structure

```
src/
  components/common     reusable UI (Button, DataTable, Modal, StatusBadge, …)
  components/layout     AppLayout, Sidebar, Topbar, Breadcrumbs, ProtectedLayout
  components/dashboard  StatCard, ChartCard, RecentActivity
  features/<module>/    <module>Service.js (API calls) + pages/ + components/
  hooks/                useAuth, useDebounce, usePagination, useLookups, useVendorNames
  services/             apiClient (Axios + interceptors), apiEndpoints, serviceRegistry
  routes/               AppRoutes (lazy pages), ProtectedRoute, RoleBasedRoute, navigation
  utils/                permissions, pagination, errors, formatters, constants
```

- **API**: one Axios client per service (`services/apiClient.js`), bearer token + `X-Correlation-Id`
  on every call; errors from both backend formats are normalised into `ApiError`.
- **Server state**: TanStack Query (caching, deduplication, cancellation). **Session**: React Context.
- **Permissions**: `utils/permissions.js` mirrors the backend role rules for navigation and buttons;
  the backend stays authoritative.
- Backend endpoint inventory and known gaps: `docs/BACKEND_API_INVENTORY.md`.
