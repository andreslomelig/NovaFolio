import { FastifyInstance } from "fastify";
import { pool, getDefaultTenantId } from "../db";
import { pipeline } from "node:stream/promises";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ensureStorageDir, pathFromStorageUrl } from "../storage";
import { z } from "zod";
import { extractPdfPages, extractDocxPages } from "../services/extract";

function sanitize(name: string) {
  return path.basename(name).replace(/[^\w.\-]+/g, "_");
}

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Indexa (o reindexa) un documento en doc_pages.
 * - Lee el archivo físico (absPath)
 * - Extrae texto por páginas según mime
 * - Limpia e inserta en doc_pages
 */
async function indexDocumentPages(params: {
  docId: string;
  mime: string;
  absPath: string;
  log: FastifyInstance["log"];
}) {
  const { docId, mime, absPath, log } = params;
  try {
    const buf = await fs.promises.readFile(absPath);

    let pages: string[] = [];
    if (mime?.startsWith("application/pdf")) {
      pages = await extractPdfPages(buf);
    } else if (mime === DOCX_MIME) {
      pages = await extractDocxPages(buf);
    } else {
      pages = []; // otros tipos no indexamos de momento
    }

    await pool.query(`DELETE FROM doc_pages WHERE doc_id=$1`, [docId]);

    for (let i = 0; i < pages.length; i++) {
      const pageNo = i + 1;
      const text = pages[i] ?? "";
      await pool.query(
        `INSERT INTO doc_pages (doc_id, page, text) VALUES ($1,$2,$3)`,
        [docId, pageNo, text]
      );
    }

    log.info({ docId, pages: pages.length }, "indexDocumentPages: done");
  } catch (e: any) {
    log.warn({ err: e, docId }, "indexDocumentPages: failed");
  }
}

export async function documentsRoutes(app: FastifyInstance) {
  // Listar (con search opcional ?q=) por case_id
  app.get("/v1/documents", async (req, reply) => {
    const { case_id, q } = (req.query as { case_id?: string; q?: string }) || {};
    if (!case_id) return reply.status(400).send({ error: "case_id required" });

    const tenantId = await getDefaultTenantId();
    const ok = await pool.query(`SELECT 1 FROM cases WHERE id=$1 AND tenant_id=$2`, [case_id, tenantId]);
    if (!ok.rowCount) return reply.status(404).send({ error: "case_not_found" });

    const term = (q ?? "").trim().toLowerCase();

    const { rows } = await pool.query(
      term
        ? `
          SELECT id::text, case_id::text, name, mime, storage_url, version, created_at
          FROM documents
          WHERE tenant_id=$1 AND case_id=$2
            AND (lower(name) LIKE $3 OR similarity(lower(name), $4) > 0.3)
          ORDER BY created_at DESC
        `
        : `
          SELECT id::text, case_id::text, name, mime, storage_url, version, created_at
          FROM documents
          WHERE tenant_id=$1 AND case_id=$2
          ORDER BY created_at DESC
        `,
      term ? [tenantId, case_id, term + "%", term] : [tenantId, case_id]
    );
    return { items: rows };
  });

  // Upload (PDF + DOCX) con indexación de páginas
  app.post("/v1/documents/upload", async (req, reply) => {
    const tenantId = await getDefaultTenantId();
    const mp = await req.file();
    if (!mp) return reply.status(400).send({ error: "multipart_file_required" });

    const case_id = mp.fields?.case_id?.value as string | undefined;
    if (!case_id) return reply.status(400).send({ error: "case_id required" });

    const ok = await pool.query(`SELECT 1 FROM cases WHERE id=$1 AND tenant_id=$2`, [case_id, tenantId]);
    if (!ok.rowCount) return reply.status(404).send({ error: "case_not_found" });

    const mime = mp.mimetype || "application/octet-stream";
    const allowed = ["application/pdf", DOCX_MIME];
    if (!allowed.some((a) => mime.startsWith(a) || mime === a)) {
      return reply.status(415).send({ error: "unsupported_media_type" });
    }

    const storageDir = ensureStorageDir();
    const id = crypto.randomUUID();
    const safeName = sanitize(mp.filename || (mime === DOCX_MIME ? "document.docx" : "document.pdf"));
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

    const newId = ins.rows[0].id;

    // Indexación en background (no bloquea la respuesta)
    setImmediate(() => {
      indexDocumentPages({
        docId: newId,
        mime,
        absPath: destPath,
        log: app.log,
      }).catch((e) => app.log.warn({ e, newId }, "indexDocumentPages: background failed"));
    });

    return reply.status(201).send({ id: newId, url: publicUrl });
  });

  // Get por id
  app.get("/v1/documents/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = await getDefaultTenantId();
    const { rows } = await pool.query(
      `SELECT id::text, case_id::text, name, mime, storage_url, version, created_at
       FROM documents WHERE id=$1 AND tenant_id=$2`,
      [id, tenantId]
    );
    if (!rows.length) return reply.status(404).send({ error: "not_found" });
    return rows[0];
  });

  // PATCH rename
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

  // DELETE (db + file no-bloqueante)
  app.delete("/v1/documents/:id", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const tenantId = await getDefaultTenantId();

      // 1) obtener la ruta del archivo
      const sel = await pool.query<{ storage_url: string }>(
        `SELECT storage_url FROM documents WHERE id=$1 AND tenant_id=$2`,
        [id, tenantId]
      );
      if (!sel.rowCount) return reply.status(404).send({ error: "not_found" });

      const storageUrl = sel.rows[0].storage_url;
      const absPath = pathFromStorageUrl(storageUrl);

      // 2) borrar en DB primero (ON DELETE CASCADE limpiará doc_pages si el FK está así)
      const del = await pool.query(`DELETE FROM documents WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
      if (!del.rowCount) return reply.status(404).send({ error: "not_found" });

      // 3) borrar archivo en background
      setImmediate(() => {
        try {
          if (fs.existsSync(absPath)) fs.rmSync(absPath);
          req.log.info({ absPath }, "documents.delete: file_removed");
        } catch (e) {
          req.log.warn({ absPath, e }, "documents.delete: file_remove_failed");
        }
      });

      return reply.status(204).send();
    } catch (err) {
      req.log.error({ err }, "documents.delete: error");
      return reply.status(500).send({ error: "internal_error" });
    }
  });

  // Render HTML de DOCX (preview)
  app.get("/v1/documents/:id/html", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const tenantId = await getDefaultTenantId();

      const sel = await pool.query<{ storage_url: string; mime: string; name: string }>(
        `SELECT storage_url, mime, name FROM documents WHERE id=$1 AND tenant_id=$2`,
        [id, tenantId]
      );
      if (!sel.rowCount) return reply.status(404).send({ error: "not_found" });

      const { storage_url, mime, name } = sel.rows[0];
      if (mime !== DOCX_MIME) {
        return reply.status(415).send({ error: "not_docx" });
      }

      const abs = pathFromStorageUrl(storage_url);
      const mammothMod: any = await import('mammoth');
      const mammoth = mammothMod.default ?? mammothMod;
      const result = await mammoth.convertToHtml({ path: abs }, {
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh"
        ]
      });
      const html = result.value; // HTML string

      const tpl = `
        <!doctype html>
        <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>${escapeHtml(name)}</title>
          <style>
            body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial; line-height: 1.6; padding: 24px; color: #0f172a; }
            h1,h2,h3 { margin: 1em 0 0.5em; }
            p { margin: 0.5em 0; }
            table { border-collapse: collapse; }
            td, th { border: 1px solid #cbd5e1; padding: 4px 6px; }
            img { max-width: 100%; height: auto; }
          </style>
        </head>
        <body>${html}</body>
        </html>
      `;

      reply.header('Content-Type', 'text/html; charset=utf-8').send(tpl);
    } catch (err) {
      req.log.error({ err }, "documents.html: error");
      reply.status(500).send({ error: "internal_error" });
    }
  });

  // Reindexar manualmente un documento existente (útil si cambiaste extractor)
  app.post("/v1/documents/:id/reindex", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const tenantId = await getDefaultTenantId();

      const q = await pool.query<{ storage_url: string; mime: string }>(
        `SELECT storage_url, mime FROM documents WHERE id=$1 AND tenant_id=$2`,
        [id, tenantId]
      );
      if (!q.rowCount) return reply.status(404).send({ error: "not_found" });

      const { storage_url, mime } = q.rows[0];
      const absPath = pathFromStorageUrl(storage_url);

      await indexDocumentPages({ docId: id, mime, absPath, log: app.log });
      return reply.status(202).send({ ok: true });
    } catch (e) {
      req.log.error({ e }, "documents.reindex: error");
      return reply.status(500).send({ error: "internal_error" });
    }
  });

  function escapeHtml(s: string) {
    return s.replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] as string));
  }
}
