// apps/api/src/routes/clients.ts
import { FastifyInstance } from "fastify";
import { pool, getDefaultTenantId } from "../db";
import { CreateClientSchema, UpdateClientSchema } from "../schemas";

export async function clientsRoutes(app: FastifyInstance) {
  // List / Search
  app.get("/v1/clients", async (req) => {
    const { q } = (req.query as { q?: string }) || {};
    const tenantId = await getDefaultTenantId();

    if (q && q.trim().length > 0) {
      const params = [tenantId, q.toLowerCase() + "%", q.toLowerCase()];
      const sql = `
        SELECT id::text, name, tags, created_at
        FROM clients
        WHERE tenant_id = $1
          AND (lower(name) LIKE $2 OR similarity(lower(name), $3) > 0.3)
        ORDER BY name ASC
        LIMIT 50
      `;
      const { rows } = await pool.query(sql, params);
      return { items: rows };
    } else {
      const { rows } = await pool.query(
        `
        SELECT id::text, name, tags, created_at
        FROM clients
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 50
        `,
        [tenantId]
      );
      return { items: rows };
    }
  });

  // Create
  app.post("/v1/clients", async (req, reply) => {
    const parse = CreateClientSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.status(400).send({ error: parse.error.flatten() });
    }
    const { name, tags } = parse.data;
    const tenantId = await getDefaultTenantId();

    const { rows } = await pool.query<{ id: string }>(
      `
      INSERT INTO clients (tenant_id, name, tags)
      VALUES ($1, $2, COALESCE($3::text[], '{}'::text[]))
      RETURNING id::text
      `,
      [tenantId, name.trim(), tags ?? null]
    );
    return reply.status(201).send({ id: rows[0].id });
  });

  // Get by id
  app.get("/v1/clients/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = await getDefaultTenantId();
    const { rows } = await pool.query(
      `
      SELECT id::text, name, tags, created_at
      FROM clients
      WHERE id = $1 AND tenant_id = $2
      `,
      [id, tenantId]
    );
    if (rows.length === 0) return reply.status(404).send({ error: "not_found" });
    return rows[0];
  });

  // Update
  app.patch("/v1/clients/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parse = UpdateClientSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.status(400).send({ error: parse.error.flatten() });
    }
    const tenantId = await getDefaultTenantId();

    const sets: string[] = [];
    const params: any[] = [id, tenantId]; // $1 id, $2 tenant

    if (parse.data.name !== undefined) {
      params.push(parse.data.name.trim());
      sets.push(`name = $${params.length}`);
    }
    if (parse.data.tags !== undefined) {
      params.push(parse.data.tags);
      // cast explícito a text[]
      sets.push(`tags = $${params.length}::text[]`);
    }
    if (sets.length === 0) return reply.status(400).send({ error: "no_fields" });

    const sql = `
      UPDATE clients
      SET ${sets.join(", ")}
      WHERE id = $1 AND tenant_id = $2
      RETURNING id::text
    `;
    const { rowCount } = await pool.query(sql, params);
    if (!rowCount) return reply.status(404).send({ error: "not_found" });
    return reply.status(204).send();
  });

  // Delete
  app.delete("/v1/clients/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = await getDefaultTenantId();
    const { rowCount } = await pool.query(
      `DELETE FROM clients WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (!rowCount) return reply.status(404).send({ error: "not_found" });
    return reply.status(204).send();
  });
}
