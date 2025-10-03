# NovaFolio

**NovaFolio — a flexible backbone for managing folders, cases, and documents, built for speed and AI.**  
Multi‑tenant case & document management system skeleton with **fast prefix search**, **calendar invites (ICS)**, and an **AI‑ready** architecture (OCR + RAG in future phases).

---

## Table of Contents
- [Features (MVP)](#features-mvp)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quickstart](#quickstart)
  - [Option A — Docker (recommended)](#option-a--docker-recommended)
  - [Option B — Without Docker (PostgreSQL installed locally)](#option-b--without-docker-postgresql-installed-locally)
- [Environment Variables](#environment-variables)
- [Smoke Tests](#smoke-tests)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [What’s Missing / Next Steps](#whats-missing--next-steps)
- [Contributing](#contributing)
- [License](#license)

---

## Features (MVP)
- 📂 **Multi-tenant**: clients, cases, documents, notes, and events per tenant.
- 🔍 **Fast prefix/partial search** using PostgreSQL `pg_trgm` (typing `fu…` finds *Fulanito*).
- 📅 **Calendar invites via ICS** (works with Gmail/Outlook/iCal; no corporate suite required).
- 🖥️ **Web UI (Next.js + Tailwind)** for quick search and listing (more screens to come).
- 🔐 Separation by tenant, codebase prepared for **RBAC** and **auditing**.

**Future (AI-ready):**
- 📑 OCR + chunk indexing (store offsets & bounding boxes).
- 🤖 Retrieval-Augmented Generation (RAG) to find exact paragraphs and open PDFs with highlights.
- 🔏 Privacy-first modes (no data retention, optional on-device inference).

---

## Tech Stack
- **Frontend:** Next.js 15 (TypeScript, TailwindCSS, App Router, `src/` layout)
- **Backend:** Fastify (TypeScript), Zod for validation (expand soon), Swagger UI
- **Database:** PostgreSQL 16 with `pg_trgm` (prefix search) and `pgvector` (for future embeddings)
- **Infra (local):** Docker Compose (Postgres; optional MinIO later)

---

## Architecture
[Web App - Next.js/Tailwind] [API - Fastify/TypeScript]
| |
v v
[PostgreSQL 16 (pg_trgm, pgvector ready)]
|
[Object Store - S3/MinIO]* (*future)



- **Now:** Prefix/partial search for clients/cases, basic CRUD (expanding).
- **Later:** OCR + embeddings + ANN + RAG; PDF open-with-highlight; ICS invites via mail provider.

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
