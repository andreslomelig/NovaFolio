// apps/api/src/routes/clients.ts
import { FastifyInstance } from "fastify";
import { pool, getDefaultTenantId } from "../db";
import { z } from "zod";
import fs from "node:fs";
import { pathFromStorageUrl } from "../storage";

const CreateClientSchema = z.object({
  name: z.string().min(1).max(200),
  tags: z.array(z.string()).optional()
});
const UpdateClientSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  tags: z.array(z.string()).optional()
});

export async function clientsRoutes(app: FastifyInstance) {
  // list/search
  app.get("/v1/clients", async (req) => {
    const { q } = (req.query as { q?: string }) || {};
    const tenantId = await getDefaultTenantId();
    const term = (q ?? "").trim().toLowerCase();

    const sql = term
      ? `
        SELECT id::text, name, tags, created_at
        FROM clients
        WHERE tenant_id=$1 AND (lower(name) LIKE $2 OR similarity(lower(name), $3) > 0.3)
        ORDER BY name ASC
        LIMIT 100
      `
      : `
        SELECT id::text, name, tags, created_at
        FROM clients
        WHERE tenant_id=$1
        ORDER BY created_at DESC
        LIMIT 100
      `;

    const params = term ? [tenantId, term + "%", term] : [tenantId];
    const { rows } = await pool.query(sql, params);
    return { items: rows };
  });

  // get by id
  app.get("/v1/clients/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = await getDefaultTenantId();
    const { rows } = await pool.query(
      `SELECT id::text, name, tags, created_at FROM clients WHERE id=$1 AND tenant_id=$2`,
      [id, tenantId]
    );
    if (!rows.length) return reply.status(404).send({ error: "not_found" });
    return rows[0];
  });

  // create
  app.post("/v1/clients", async (req, reply) => {
    const parse = CreateClientSchema.safeParse(req.body);
    if (!parse.success) return reply.status(400).send({ error: parse.error.flatten() });

    const { name, tags } = parse.data;
    const tenantId = await getDefaultTenantId();
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO clients (tenant_id, name, tags)
       VALUES ($1, $2, COALESCE($3::text[], '{}'::text[]))
       RETURNING id::text`,
      [tenantId, name.trim(), tags ?? null]
    );
    return reply.status(201).send({ id: rows[0].id });
  });

  // update (name/tags)
  app.patch("/v1/clients/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parse = UpdateClientSchema.safeParse(req.body);
    if (!parse.success) return reply.status(400).send({ error: parse.error.flatten() });

    const tenantId = await getDefaultTenantId();
    const sets: string[] = [];
    const params: any[] = [id, tenantId]; // $1 id, $2 tenant

    if (parse.data.name !== undefined) { params.push(parse.data.name.trim()); sets.push(`name = $${params.length}`); }
    if (parse.data.tags !== undefined) { params.push(parse.data.tags);        sets.push(`tags = $${params.length}::text[]`); }
    if (!sets.length) return reply.status(400).send({ error: "no_fields" });

    const { rowCount } = await pool.query(
      `UPDATE clients SET ${sets.join(", ")} WHERE id=$1 AND tenant_id=$2`, params
    );
    if (!rowCount) return reply.status(404).send({ error: "not_found" });
    return reply.status(204).send();
  });

  // delete
  app.delete("/v1/clients/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = await getDefaultTenantId();

    const cx = await pool.connect();
    try {
      await cx.query("BEGIN");

      // 1) Traer todos los archivos de todos los docs de los casos de este cliente
      const docFiles = await cx.query<{ storage_url: string }>(
        `
        SELECT d.storage_url
        FROM documents d
        WHERE d.tenant_id=$1 AND d.case_id IN (
          SELECT c.id FROM cases c WHERE c.tenant_id=$1 AND c.client_id=$2
        )
        `,
        [tenantId, id]
      );
      const filePaths = docFiles.rows.map(r => pathFromStorageUrl(r.storage_url));

      // 2) Borrar documentos, luego casos, luego cliente
      await cx.query(
        `DELETE FROM documents
        WHERE tenant_id=$1 AND case_id IN (SELECT id FROM cases WHERE tenant_id=$1 AND client_id=$2)`,
        [tenantId, id]
      );
      await cx.query(`DELETE FROM cases WHERE tenant_id=$1 AND client_id=$2`, [tenantId, id]);

      const delClient = await cx.query(`DELETE FROM clients WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
      if (!delClient.rowCount) {
        await cx.query("ROLLBACK");
        return reply.status(404).send({ error: "not_found" });
      }

      await cx.query("COMMIT");

      // 3) Borrado de archivos en background
      setImmediate(() => {
        for (const p of filePaths) {
          try { if (fs.existsSync(p)) fs.rmSync(p); }
          catch (e) { req.log.warn({ p, e }, "clients.delete file_remove_failed"); }
        }
      });

      return reply.status(204).send();
    } catch (err) {
      await cx.query("ROLLBACK");
      req.log.error({ err }, "clients.delete error");
      return reply.status(500).send({ error: "internal_error" });
    } finally {
      cx.release();
    }
  });
}
