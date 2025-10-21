// apps/api/src/routes/cases.ts
import { FastifyInstance } from "fastify";
import { pool, getDefaultTenantId } from "../db";
import { z } from "zod";

const CreateCaseSchema = z.object({
  client_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  status: z.string().default("open").optional()
});

export async function casesRoutes(app: FastifyInstance) {
  // List + search cases for a client
  app.get("/v1/cases", async (req, reply) => {
    const { client_id, q } = (req.query as { client_id?: string; q?: string }) || {};
    if (!client_id) return reply.status(400).send({ error: "client_id required" });

    const tenantId = await getDefaultTenantId();
    const term = (q ?? "").trim().toLowerCase();

    if (term) {
      const { rows } = await pool.query(
        `
        SELECT id::text, client_id::text, title, status, created_at
        FROM cases
        WHERE tenant_id=$1 AND client_id=$2
          AND (lower(title) LIKE $3 OR similarity(lower(title), $4) > 0.3)
        ORDER BY created_at DESC
        LIMIT 100
        `,
        [tenantId, client_id, term + "%", term]
      );
      return { items: rows };
    } else {
      const { rows } = await pool.query(
        `
        SELECT id::text, client_id::text, title, status, created_at
        FROM cases
        WHERE tenant_id=$1 AND client_id=$2
        ORDER BY created_at DESC
        LIMIT 100
        `,
        [tenantId, client_id]
      );
      return { items: rows };
    }
  });

  // Get case by id
  app.get("/v1/cases/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = await getDefaultTenantId();
    const { rows } = await pool.query(
      `
      SELECT id::text, client_id::text, title, status, created_at
      FROM cases
      WHERE id=$1 AND tenant_id=$2
      `,
      [id, tenantId]
    );
    if (!rows.length) return reply.status(404).send({ error: "not_found" });
    return rows[0];
  });

  // Create case
  app.post("/v1/cases", async (req, reply) => {
    const parse = CreateCaseSchema.safeParse(req.body);
    if (!parse.success) return reply.status(400).send({ error: parse.error.flatten() });

    const { client_id, title, status } = parse.data;
    const tenantId = await getDefaultTenantId();

    // Ensure client belongs to tenant
    const ok = await pool.query(`SELECT 1 FROM clients WHERE id=$1 AND tenant_id=$2`, [client_id, tenantId]);
    if (!ok.rowCount) return reply.status(404).send({ error: "client_not_found" });

    const ins = await pool.query<{ id: string }>(
      `INSERT INTO cases (tenant_id, client_id, title, status)
       VALUES ($1,$2,$3,$4) RETURNING id::text`,
      [tenantId, client_id, title.trim(), status ?? "open"]
    );
    return reply.status(201).send({ id: ins.rows[0].id });
  });
}
