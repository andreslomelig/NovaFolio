// apps/api/src/routes/documents.ts
import { FastifyInstance } from "fastify";
import { pool, getDefaultTenantId } from "../db";
import { pipeline } from "node:stream/promises";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ensureStorageDir, pathFromStorageUrl } from "../storage";
import { z } from "zod";

function sanitize(name: string) {
  return path.basename(name).replace(/[^\w.\-]+/g, "_");
}

export async function documentsRoutes(app: FastifyInstance) {
  // List documents by case_id (+ optional q)
  app.get("/v1/documents", async (req, reply) => {
    try {
      const { case_id, q } = (req.query as { case_id?: string; q?: string }) || {};
      if (!case_id) return reply.status(400).send({ error: "case_id required" });

      const tenantId = await getDefaultTenantId();
      const ok = await pool.query(`SELECT 1 FROM cases WHERE id=$1 AND tenant_id=$2`, [case_id, tenantId]);
      if (ok.rowCount === 0) return reply.status(404).send({ error: "case_not_found" });

      const term = (q ?? "").trim().toLowerCase();

      if (term) {
        const { rows } = await pool.query(
          `
          SELECT id::text, case_id::text, name, mime, storage_url, version, created_at
          FROM documents
          WHERE tenant_id=$1 AND case_id=$2
            AND (lower(name) LIKE $3 OR similarity(lower(name), $4) > 0.3)
          ORDER BY created_at DESC
          `,
          [tenantId, case_id, term + "%", term]
        );
        return { items: rows };
      } else {
        const { rows } = await pool.query(
          `
          SELECT id::text, case_id::text, name, mime, storage_url, version, created_at
          FROM documents
          WHERE tenant_id=$1 AND case_id=$2
          ORDER BY created_at DESC
          `,
          [tenantId, case_id]
        );
        return { items: rows };
      }
    } catch (err) {
      req.log.error({ err }, "documents.list: error");
      return reply.status(500).send({ error: "internal_error" });
    }
  });

  // Upload document (PDF)
  app.post("/v1/documents/upload", async (req, reply) => {
    const tenantId = await getDefaultTenantId();

    const mp = await req.file();
    if (!mp) return reply.status(400).send({ error: "multipart_file_required" });

    const case_id = mp.fields?.case_id?.value as string | undefined;
    if (!case_id) return reply.status(400).send({ error: "case_id required" });

    const ok = await pool.query(`SELECT 1 FROM cases WHERE id=$1 AND tenant_id=$2`, [case_id, tenantId]);
    if (ok.rowCount === 0) return reply.status(404).send({ error: "case_not_found" });

    const mime = mp.mimetype || "application/octet-stream";
    if (!mime.startsWith("application/pdf")) {
      return reply.status(415).send({ error: "only_pdf_supported_for_now" });
    }

    const storageDir = ensureStorageDir();
    const id = crypto.randomUUID();
    const safeName = sanitize(mp.filename || "document.pdf");
    const baseName = `${id}_${safeName}`;
    const destPath = path.join(storageDir, baseName);
    const publicUrl = `/files/${baseName}`;

    await pipeline(mp.file, fs.createWriteStream(destPath));

    const ins = await pool.query<{ id: string }>(
      `
      INSERT INTO documents (tenant_id, case_id, name, mime, storage_url, sha256, version, created_by)
      VALUES ($1,$2,$3,$4,$5,NULL,1,NULL)
      RETURNING id::text
      `,
      [tenantId, case_id, safeName, mime, publicUrl]
    );

    return reply.status(201).send({ id: ins.rows[0].id, url: publicUrl });
  });

  // Get doc by id
  app.get("/v1/documents/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = await getDefaultTenantId();
    const { rows } = await pool.query(
      `
      SELECT id::text, case_id::text, name, mime, storage_url, version, created_at
      FROM documents
      WHERE id=$1 AND tenant_id=$2
      `,
      [id, tenantId]
    );
    if (!rows.length) return reply.status(404).send({ error: "not_found" });
    return rows[0];
  });

  // Rename
  app.patch("/v1/documents/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const bodySchema = z.object({ name: z.string().min(1).max(255) });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const tenantId = await getDefaultTenantId();
    const { rowCount } = await pool.query(
      `UPDATE documents SET name=$1 WHERE id=$2 AND tenant_id=$3`,
      [parsed.data.name.trim(), id, tenantId]
    );
    if (!rowCount) return reply.status(404).send({ error: "not_found" });
    return reply.status(204).send();
  });

  // Delete (db + file)
  app.delete("/v1/documents/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = await getDefaultTenantId();

    const sel = await pool.query<{ storage_url: string }>(
      `SELECT storage_url FROM documents WHERE id=$1 AND tenant_id=$2`,
      [id, tenantId]
    );
    if (!sel.rowCount) return reply.status(404).send({ error: "not_found" });

    const storageUrl = sel.rows[0].storage_url;
    const abs = pathFromStorageUrl(storageUrl);

    await pool.query(`DELETE FROM documents WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    try { if (fs.existsSync(abs)) fs.rmSync(abs); } catch { /* ignore */ }

    return reply.status(204).send();
  });
}
