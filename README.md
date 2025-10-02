# NovaFolio

**NovaFolio** es un esqueleto multi‑tenant para gestionar **carpetas/casos/documentos** con **búsqueda rápida** (prefijo/parcial tipo “fu…”) y base preparada para **IA (RAG)** y **eventos ICS**.

> Objetivo: que funcione para cualquier negocio (legal, salud, servicios) y, más adelante, permita “abrir y subrayar” el pasaje exacto con IA on‑prem o gestionada.

---

## Stack (MVP)
- **Frontend**: Next.js (TypeScript).
- **API**: Fastify (TypeScript).
- **DB**: Postgres 16 con `pg_trgm` (búsqueda por prefijo) y `pgvector` (IA futura).
- **Infra local**: Docker Compose (Postgres).

---

## Estructura
