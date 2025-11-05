# NovaFolio — Intelligent Client & Document Management (PDF/DOCX, Search, AI‑ready)

> **Full‑stack, TypeScript‑first** portfolio project that feels like a real product.  
> Upload, organize, **search**, and open client documents; clean API, modern React UI, and a clear path to **AI** features.

---

## What it does (today)

- **Clients & Cases**: Create clients, create cases per client, track **open/closed** status.
- **Documents**: Upload **PDF** and **DOCX** to a case, rename, delete, and open.
- **PDF Viewer**: In‑app viewer with **find & highlight** and **jump to page**.
- **Content Search (per case)**: Search **inside** all documents of a case (returns *doc → page → snippet*). Click to open exactly at the right page with your query pre‑highlighted.
- **DOCX Preview**: Server‑side `.docx` → HTML preview; link to original file.
- **Clean Developer Experience**: Monorepo, TypeScript, Zod validation, hot reload, and pragmatic SQL.

> **AI‑ready**: We already index text per page (`doc_pages`) and expose a search endpoint.  
> Next steps: add embeddings (`pgvector`) + semantic search alongside keyword search.

---

## Repository Layout

```
NovaFolio/
├─ apps/
│  ├─ api/              # Fastify + TypeScript API (ESM + tsx)
│  └─ web/              # Next.js 15 app (React + Tailwind)
├─ infra/
│  ├─ docker-compose.yml# Postgres service (pg_trgm enabled)
│  └─ sql/              # ad-hoc SQL migrations (manual mode)
└─ README.md
```

---

## Architecture (high‑level)

```mermaid
flowchart LR
A[Web App (Next.js 15, Tailwind)] --> B[/API (Fastify, TypeScript, Zod)/]
B --> C[(PostgreSQL 16<br/>pg_trgm enabled, AI-ready)]
B --> D[(Local Object Store: /files)]
B -.-> E[(S3/MinIO) *future*]
```

- **Web (`apps/web`)**: Next.js App Router. Uses **react‑pdf‑viewer** with pdf.js **3.x**.  
  Proxies API via `/backend/*` to avoid CORS in dev.
- **API (`apps/api`)**: Fastify + TypeScript. Serves REST endpoints, static files (`/files/*`), and extracts/ indexes text per page (`pdf-parse` for PDF, `mammoth` for DOCX).
- **DB**: PostgreSQL with **pg_trgm** and **tsvector** for fast search.  
  Table `doc_pages` stores text **per page**, powering “search inside case”.

---

## Prerequisites

- **Node.js 18+** (tested with 22.x)
- **Docker Desktop** (to run Postgres)
- **npm** (or pnpm/yarn if you prefer)

---

## Quick Start (Development)

### 0) Clone

```bash
git clone https://github.com/andreslomelig/NovaFolio.git
cd NovaFolio
```

### 1) Start **Postgres** with Docker

From the repo root (where `infra/docker-compose.yml` lives):

```bash
# Up the DB (service name may vary, see NOTE below)
docker compose -f infra/docker-compose.yml up -d
```

> **NOTE (Postgres service name)**  
> _If your service name it's not `db`, replace it for the correct one (p.ej. `postgres`)._  
> Several commands below use `db` as the service name—adjust as needed based on your `docker-compose.yml`.

If you need to create the database/role explicitly (depends on your compose), exec into the container and run:

```bash
# Windows PowerShell (example; replace 'db' with your service name if different)
docker compose -f .\infra\docker-compose.yml exec -it db psql -U <DB_USER> -c "CREATE DATABASE novafolio;"
```

> About `-U Novafolio`: if your `docker-compose.yml` sets `POSTGRES_USER=Novafolio`, use that exact user in `psql -U ...`.  
> Postgres folds unquoted identifiers to lower case, so `Novafolio` and `novafolio` commonly resolve to the same role unless quoted in SQL.

### 2) Create the **search** table + extensions (one time)

We maintain migrations as plain SQL for now. Open file:

```
infra/sql/2025-10-29_doc_pages.sql
```

(change `'english'` to `'spanish'` if most documents are in Spanish):

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS doc_pages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id     uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page       int  NOT NULL,
  text       text NOT NULL,
  tsv        tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS doc_pages_doc_page_uq ON doc_pages(doc_id, page);
CREATE INDEX IF NOT EXISTS doc_pages_text_trgm_idx ON doc_pages USING gin (text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS doc_pages_tsv_idx      ON doc_pages USING gin (tsv);
```

Apply it:

```bash
# macOS/Linux
cat infra/sql/2025-10-29_doc_pages.sql | docker compose -f infra/docker-compose.yml exec -T db psql -U <DB_USER> -d novafolio

# Windows PowerShell
type .\infra\sql\2025-10-29_doc_pages.sql | docker compose -f .\infra\docker-compose.yml exec -T db psql -U <DB_USER> -d novafolio
```

_Replace `<DB_USER>` with the user configured in your `docker-compose.yml` (e.g., `Novafolio`)._

### 3) Configure **API** (`apps/api`)

```bash
cd apps/api
npm install
```

Create `.env`:

```env
# Adjust user/pass/host/db to your compose
DATABASE_URL=postgresql://<DB_USER>:<DB_PASSWORD>@localhost:5432/novafolio
PORT=4000

# Optional: absolute directory to store uploaded files
# If omitted, the app will ensure a default folder under apps/api
# STORAGE_DIR=C:\Users\andre\Desktop\NovaFolio\uploads
```

Run:

```bash
npm run dev
```

You should see:

- API listening at **http://localhost:4000**
- Static files served at **/files/** (e.g., `http://localhost:4000/files/<uuid>_name.pdf`)

**Key endpoints (subset):**

| Method | Path                                   | Purpose                                  |
|-------:|----------------------------------------|------------------------------------------|
| GET    | `/v1/clients/:id`                      | Get client                                |
| GET    | `/v1/cases/:id`                        | Get case                                  |
| PATCH  | `/v1/cases/:id`                        | Update case status                        |
| DELETE | `/v1/cases/:id`                        | Delete case + its documents               |
| GET    | `/v1/documents?case_id=...&q=...`      | List case docs (name filter optional)     |
| POST   | `/v1/documents/upload`                 | Upload PDF/DOCX to a case                 |
| GET    | `/v1/documents/:id`                    | Get document meta                         |
| PATCH  | `/v1/documents/:id`                    | Rename document                           |
| DELETE | `/v1/documents/:id`                    | Delete document (DB first, then file)     |
| GET    | `/v1/documents/:id/html`               | DOCX → HTML preview                       |
| POST   | `/v1/documents/:id/reindex`            | Re‑extract pages (PDF/DOCX → `doc_pages`) |
| GET    | `/v1/search?q=...&case_id=...`         | Search inside case (returns page/snippet) |

> On upload, the API extracts text per page (PDF: `pdf-parse`, DOCX: `mammoth`) and inserts rows in `doc_pages`.  
> The `/v1/search` endpoint uses `pg_trgm` + `tsvector` to return relevant (doc, page, snippet) results.

### 4) Configure **Web** (`apps/web`)

```bash
cd ../web
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

Install PDF viewer packages (pinned for compatibility):

```bash
npm i -E @react-pdf-viewer/core@3.12.0 \
         @react-pdf-viewer/default-layout@3.12.0 \
         @react-pdf-viewer/search@3.12.0 \
         @react-pdf-viewer/page-navigation@3.12.0 \
         pdfjs-dist@3.11.174
```

`next.config.mjs` (ensure these are present):

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Same-origin proxy to your API (avoids CORS in dev)
      { source: '/backend/:path*', destination: 'http://localhost:4000/:path*' },
    ];
  },

  webpack: (config, { isServer }) => {
    // Avoid bundling node-canvas when pdfjs-dist is analyzed by webpack
    config.resolve.alias = { ...(config.resolve.alias || {}), canvas: false };
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({ canvas: 'commonjs canvas' });
    }
    return config;
  },
};

export default nextConfig;
```

Run:

```bash
npm run dev
```

Open **http://localhost:3000**.

---

## Try it (Suggested Flow)

1. **Create a client** → open the client → **add a case** and set it **Open**.
2. **Upload** a **PDF** (and/or `.docx`) to that case.
3. In the case page:
   - Use **“Search files”** to filter by file name.
   - Use **“Search inside this case”** to find a term across all documents.  
     Click a hit → opens `/doc/:id?q=term&page=N` with the viewer on the correct page and the term highlighted.
4. From the list:
   - **View** (in-app), **Open** (raw file), **Rename**, or **Delete** a document.
5. Change case status to **Closed** or **Delete case** (cascades).

---

## Tech Stack (highlights)

- **Web**: Next.js 15, React, Tailwind, **react-pdf-viewer** (pdf.js 3.x), App Router
- **API**: Fastify, TypeScript (ESM), tsx, Zod
- **Search**: PostgreSQL `pg_trgm` + `tsvector`, `doc_pages` (per-page text)
- **Extractors**: `pdf-parse` for PDF, `mammoth` for DOCX → HTML preview + text
- **Files**: Served under `/files/*` by Fastify Static (local filesystem); S3/MinIO planned

---

## Notes on Security & Production

- **Auth**: Not enabled yet (deliberately for demo). Add a JWT provider (Clerk/Auth.js) before going public.
- **CORS**: Dev uses a same-origin proxy (`/backend`). For prod, configure CORS as needed at the API.
- **Storage**: Local FS for uploads. In prod, use **S3/MinIO** and store only signed URLs + metadata in DB.
- **PII / Legal docs**: The design anticipates **multi-tenant** and RLS (Row-Level Security) if you deploy to a shared environment.

---

## AI Roadmap (short)

- `doc_chunks` table with 1–2k char chunks per page.
- Compute **embeddings** (OpenAI or local model) → store in `pgvector`.
- `/v1/search` returns hybrid results (keyword + semantic), with page/offsets to highlight in viewer.
- Conversation agent to “locate clauses” (→ open & highlight), summarize cases, and suggest follow-ups.

---

## Troubleshooting

- **API prints** `No se pudo conectar a Postgres. Revisa DATABASE_URL.`  
  → Check the container is up and `DATABASE_URL` is correct. Try:
  ```bash
  docker compose -f infra/docker-compose.yml ps
  docker compose -f infra/docker-compose.yml logs db   # or 'postgres' if your service has that name
  ```
- **`"root" option must be an absolute path` (Fastify Static)**  
  → Ensure your storage dir is absolute (or let the app create a default absolute dir).
- **Web shows “Failed to fetch” on rename/delete**  
  → Verify `NEXT_PUBLIC_API_BASE_URL` points to `http://localhost:4000` (same machine) and the API is running.
- **PDF viewer complains about `canvas` or stays blank**  
  → Ensure `pdfjs-dist@3.11.174`, `@react-pdf-viewer/*@3.12.0`, and the `next.config.mjs` alias for `canvas: false`.  
  Clear Next cache (`rm -rf .next`) and re-run `npm run dev`.
- **Can’t access from phone on LAN**  
  → Next 15 warns about **allowedDevOrigins**. For LAN testing, set `HOST=0.0.0.0` and configure `allowedDevOrigins` in `next.config.mjs` as per Next docs.

---

## Contributing / What’s next

- Add S3/MinIO adapter, signed URLs, and background virus scanning.
- Add **OnlyOffice** (or Collabora) integration for **in‑browser editing** of DOCX and webhook save-back.
- Implement **highlights persistence** (`doc_highlights`) and overlay them in the viewer.
- Add **pgvector** + semantic search and unify results.

Conventional Commits are welcome:
```
feat: ...
fix: ...
docs: ...
refactor: ...
```

---

## Author

**Andrés Lomelí Garduño**   
LinkedIn: https://linkedin.com/in/andreslomeli

---

## License

MIT © 2025 Andrés Lomelí Garduño
