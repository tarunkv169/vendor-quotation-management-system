# Running VQMS in Docker

The whole platform runs as 15 containers: PostgreSQL, Eureka, 11 backend services, the API gateway
and the React UI. Every image is built from the source in this repository, so nothing needs to be
downloaded from Docker Hub except the base images.

| Open | URL |
|---|---|
| Application (UI) | http://localhost:3000 |
| API gateway | http://localhost:8080 |
| Eureka dashboard (registered services) | http://localhost:8761 |

## 1. One-time preparation

1. **Install and start Docker Desktop.**
2. **Give Docker enough memory.** The stack needs about 4.5 GB. On Windows, Docker uses WSL 2; create
   `C:\Users\<you>\.wslconfig` with:
   ```ini
   [wsl2]
   memory=6GB
   ```
   then run `wsl --shutdown` and start Docker Desktop again.
3. **Free the ports 3000, 8080 and 8761.**
   - Stop the services started with `backend\run-local.ps1`: `.\run-local.ps1 stop`
   - Stop the Vite dev server (`npm run dev`) if it is running.
   - Remove old containers that use these ports: `docker ps -a`, then `docker rm -f <name>`.
4. **Settings file.** `.env` (next to `docker-compose.yml`) holds the passwords and secrets. It was
   created from `.env.example`. `JWT_SECRET` must stay equal to the secret the Identity Service signs
   with (`VendorQuotationApplication` `JwtUtil`); otherwise every request returns 401.

## 2. Start

From the project root (or from this folder):

```powershell
docker compose up -d --build
```

The first build downloads Maven and npm dependencies and takes 15–30 minutes. Later starts take about
2–3 minutes. Watch progress with:

```powershell
docker compose ps
docker compose logs -f gateway-service
```

When everything is up, the Eureka dashboard lists 11 applications: the gateway, the Identity / Vendor /
Procurement app (VENDORQUOTATIONAPPLICATION) and the quotation, document, validation, comparison,
recommendation, approval, audit, notification and reporting services. Eureka does not list itself, and
the Python AI extraction service is reached by the gateway directly.

On a laptop with 8 GB RAM the first start can take 8–10 minutes because all Java services start at
once; later restarts are faster. VQMS sign-in uses its own JWT tokens (Identity Service).

## 3. First login

The containers use their own empty database. Register an account on the login page
(http://localhost:3000/register) as **Employee** or **Vendor**.

## Everyday commands

| Task | Command |
|---|---|
| Stop everything (data is kept) | `docker compose down` |
| Stop and delete all data | `docker compose down -v` |
| Rebuild one service after a code change | `docker compose up -d --build approval-service` |
| …then refresh the gateway's addresses | `docker restart vqms-gateway` |
| Restart one service | `docker compose restart monolith` |
| With LocalStack S3 | `docker compose --profile s3 up -d --build` |

> After rebuilding a single service its container gets a new internal IP address; restart the gateway
> (`docker restart vqms-gateway`) so it does not keep sending requests to the old address.

## Optional features

- **Document upload / download** needs S3: set `S3_ENABLED=true` in `.env`, start with `--profile s3`,
  and create the bucket once: `docker exec vqms-localstack awslocal s3 mb s3://vqms-documents-dev`.
- **AI extraction** needs an LLM: set `LLM_ENABLED=true`, `LLM_MODEL` and `LLM_API_KEY` in `.env`.

## Publishing images to Docker Hub (optional)

Set `DOCKER_HUB_USER` in `.env` to your Docker Hub username, run `docker login`, then
`.\docker-publish.ps1`. Other machines can then run `docker compose pull` and
`docker compose up -d --no-build`.
