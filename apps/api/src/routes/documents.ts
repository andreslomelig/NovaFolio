import { FastifyInstance } from "fastify";
import { pool, getDefaultTenantId } from "../db";
import { pipeline } from "node:stream/promises";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ensureStorageDir } from "../storage"; // ⬅️ nuevo

function sanitize(name: string) {
  return path.basename(name).replace(/[^\w.\-]+/g, "_");
}

export async function documentsRoutes(app: FastifyInstance) {
  // ...

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

  // Listar documentos por case_id
  app.get("/v1/documents", async (req, reply) => {
    try {
      const { case_id } = (req.query as { case_id?: string }) || {};
      if (!case_id) return reply.status(400).send({ error: "case_id required" });

      const tenantId = await getDefaultTenantId();
      req.log.info({ case_id, tenantId }, "documents.list: incoming");

      // verifica pertenencia del caso al tenant
      const ok = await pool.query(`SELECT 1 FROM cases WHERE id=$1 AND tenant_id=$2`, [case_id, tenantId]);
      if (ok.rowCount === 0) {
        req.log.warn({ case_id, tenantId }, "documents.list: case_not_found");
        return reply.status(404).send({ error: "case_not_found" });
      }

      const { rows } = await pool.query(
        `
        SELECT id::text, name, mime, storage_url, version, created_at
        FROM documents
        WHERE tenant_id=$1 AND case_id=$2
        ORDER BY created_at DESC
        `,
        [tenantId, case_id]
      );
      req.log.info({ case_id, count: rows.length }, "documents.list: ok");
      return { items: rows };
    } catch (err) {
      req.log.error({ err }, "documents.list: error");
      return reply.status(500).send({ error: "internal_error" });
    }
  });

}
