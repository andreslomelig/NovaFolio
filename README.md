# NovaFolio

**NovaFolio — a flexible backbone for managing folders, cases, and documents, built for speed and AI.**  
Multi‑tenant case & document management system skeleton with **fast prefix search**, **calendar invites (ICS)**, and an **AI‑ready** architecture (OCR + RAG in future phases).

---

## Table of Contents
- [Features (MVP)](#features-mvp)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quickstart](#quickstart)
  - [Option A — Docker (recommended)](#option-a--docker-recommended)
- [Project Structure](#project-structure)
- [What’s Missing / Next Steps](#whats-missing--next-steps)

---

## Features (MVP)
- **Multi-tenant**: clients, cases, documents, notes, and events per tenant.
- **Fast prefix/partial search** using PostgreSQL `pg_trgm` (typing `fu…` finds *Fulanito*).
- **Calendar invites via ICS** (works with Gmail/Outlook/iCal; no corporate suite required).
- **Web UI (Next.js + Tailwind)** for quick search and listing (more screens to come).
- Separation by tenant, codebase prepared for **RBAC** and **auditing**.

**Future (AI-ready):**
- OCR + chunk indexing (store offsets & bounding boxes).
- Retrieval-Augmented Generation (RAG) to find exact paragraphs and open PDFs with highlights.
- Privacy-first modes (no data retention, optional on-device inference).

---

## Tech Stack
- **Frontend:** Next.js 15 (TypeScript, TailwindCSS, App Router, `src/` layout)
- **Backend:** Fastify (TypeScript), Zod for validation (expand soon), Swagger UI
- **Database:** PostgreSQL 16 with `pg_trgm` (prefix search) and `pgvector` (for future embeddings)
- **Infra (local):** Docker Compose (Postgres; optional MinIO later)

---

## Prerequisites
- **Node.js** 20+ and **npm**
- **Git**
- **Docker Desktop** (recommended for Option A)
  - **Windows:** Ensure Docker Desktop is running (whale icon).  
    - If you see `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`, Docker isn’t running.
    - Enable **WSL 2** engine: Docker Desktop → *Settings* → *General* → **Use the WSL 2 based engine**.
    - Check: `docker version`, `docker info`.

---

## Quickstart

> Repo layout assumes:
> ```
> NovaFolio/
>   apps/
>     api/
>     web/
>   infra/
>     docker-compose.yml
>     postgres/init/0001_init.sql
>     postgres/init/0002_seed.sql
> ```
> If your structure differs, adapt paths accordingly.

### Option A — Docker (recommended)

#### 1) Start PostgreSQL (Docker Compose)
From the **project root**:
```bash
# macOS/Linux
docker compose -f infra/docker-compose.yml up -d

# Windows (PowerShell)
docker compose -f .\infra\docker-compose.yml up -d
```

First run will pull the image ankane/pgvector:latest, create DB novafolio, and apply SQL scripts in infra/postgres/init/* (extensions + schema + optional seed).


```bash
docker ps
# Should list a container like "novafolio-postgres"

docker logs -f novafolio-postgres
```

#### 2) Run the API
```bash
cd apps/api
# If you don't have .env yet:
# Windows (PowerShell)
"PORT=4000`nDATABASE_URL=postgres://novafolio:novafolio@localhost:5432/novafolio`n" | Set-Content .\.env

# Install deps & start
npm install
npm run dev
```
API: http://localhost:4000/healthz
Swagger: http://localhost:4000/docs
Sample search: http://localhost:4000/v1/clients?q=fu

#### 3) Run the Web App
```bash
cd ../web
# If you don't have .env.local yet:
# Windows (PowerShell)
"NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`n" | Set-Content .\.env.local

npm install
npm run dev
```
Web: http://localhost:3000
Try searching fu (should return demo clients if seed ran).

## Environment Variables
### API (apps/api/.env)
```bash
PORT=4000
DATABASE_URL=postgres://novafolio:novafolio@localhost:5432/novafolio
```
### Web (apps/web/.env.local)
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```
## What’s Missing / Next Steps
- CRUD for clients/cases/documents/notes/events (API + Web forms, Zod validation).
- File uploads + PDF preview (pdf.js) + S3/MinIO storage (versioning).
- ICS generation + email delivery (SendGrid/SES).
- RBAC per tenant and case; Audit logs (view/download traces).
- OCR pipeline (Tesseract/PaddleOCR) and document_chunks with offsets/bboxes.
- AI/RAG: embeddings, ANN (pgvector/Qdrant), cross-encoder re-rank, “open with highlight”.
- Observability: OpenTelemetry, P50/P95 latencies, error budgets.
