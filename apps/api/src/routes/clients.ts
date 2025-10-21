// apps/api/src/routes/clients.ts
import { FastifyInstance } from "fastify";
import { pool, getDefaultTenantId } from "../db";
import { z } from "zod";

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
    const { rowCount } = await pool.query(`DELETE FROM clients WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    if (!rowCount) return reply.status(404).send({ error: "not_found" });
    return reply.status(204).send();
  });
}
