# NovaFolio — Intelligent Client & Document Management System

> **Full-stack project** designed to demonstrate applied engineering and AI capabilities.  
> Built with modern TypeScript tooling, a scalable monorepo architecture, and focus on real-world performance and maintainability.

---

## Overview

NovaFolio is a **smart client and document management system** that allows professionals (e.g., lawyers, consultants, or agencies) to store, search, and organize their client “folders” (`carpetas`) with powerful indexing, status tracking, and AI-assisted document retrieval.

It combines a clean API, modern developer experience, and scalable architecture — serving both as a **production-grade prototype** and a **portfolio showcase** of back-end, front-end, and AI integration skills.

---

## Architecture

| Layer | Description |
|-------|--------------|
| **API (`apps/api`)** | Node.js + TypeScript service built with ESM and `tsx` runtime. Provides folder/document management, search endpoints, and authentication. |
| **Web (`apps/web`)** | React (planned) front-end using Vite + Tailwind + shadcn/ui for fast iteration and clean design. |
| **Shared (`packages/*`)** | Type-safe domain logic shared between API and Web layers (types, utilities, validation). |
| **Database** | PostgreSQL with Prisma ORM (migrations, type-safe queries, seed data). |
| **AI Integration** | Planned embedding-based search and summarization (OpenAI / local LLM). |

---

## Features

✅ Multi-client document storage (upload + metadata)  
✅ Folder (“carpeta”) grouping with tags and status tracking  
✅ Global search and filters (client name, document type, status)  
✅ REST API with input validation (Zod)  
✅ Type-safe monorepo via Nx + TypeScript project references  
✅ Hot reload via `tsx watch`  
Upcoming: AI-powered semantic search and automatic folder summaries

---

## Setup

### 1️⃣ Install dependencies

```bash
npm install
```

### 2️⃣ Set environment variables

Create a `.env` file in the root folder:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/novafolio"
PORT=3000
```

### 3️⃣ Run development server

```bash
npm run dev
```

By default, the API runs on **http://localhost:3000**

---

## Tech Stack

- **Node.js + TypeScript (ESM)**
- **tsx** (fast TypeScript runtime)
- **Nx Monorepo**
- **PostgreSQL + Prisma**
- **Zod** (validation)
- **React + Vite** *(planned)*
- **Tailwind + shadcn/ui** *(planned)*
- **AI Layer (OpenAI / local embeddings)** *(planned)*

---

## Example API Routes

| Method | Endpoint | Description |
|---------|-----------|-------------|
| `GET` | `/api/folders` | List all folders |
| `POST` | `/api/folders` | Create new folder |
| `GET` | `/api/folders/:id` | Retrieve a folder and its documents |
| `POST` | `/api/folders/:id/upload` | Upload document to a folder |

---

## Roadmap

- [ ] Implement document upload with metadata
- [ ] Integrate Prisma migrations and seeding
- [ ] Add AI-powered semantic search (embeddings)
- [ ] Build frontend dashboard with folder search and filters
- [ ] Add authentication (JWT / Clerk)
- [ ] Deploy backend to Railway / Render

---

## Author

**Andrés Lomelí Garduño**  
📍 Senior AI Student @ Universidad Panamericana  
🏅 ICPC World Finalist 2025  
💡 Interned at Huawei (GPU/Parallel Systems) & Oracle (Kernel/eBPF)  
🔗 [linkedin.com/in/andreslomeli](https://linkedin.com/in/andreslomeli)

---

## License

MIT License © 2025 Andrés Lomelí Garduño
