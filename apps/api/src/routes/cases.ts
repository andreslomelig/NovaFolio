import { FastifyInstance } from "fastify";
import { pool, getDefaultTenantId } from "../db";
import { z } from "zod";

const CreateCaseSchema = z.object({
  client_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  status: z.string().default("open").optional()
});

export async function casesRoutes(app: FastifyInstance) {
  // Listar casos por cliente
  app.get("/v1/cases", async (req, reply) => {
    const { client_id } = (req.query as { client_id?: string }) || {};
    if (!client_id) return reply.status(400).send({ error: "client_id required" });
    const tenantId = await getDefaultTenantId();
    const { rows } = await pool.query(
      `
      SELECT c.id::text, c.title, c.status, c.created_at
      FROM cases c
      WHERE c.tenant_id = $1 AND c.client_id = $2
      ORDER BY c.created_at DESC
      `,
      [tenantId, client_id]
    );
    return { items: rows };
  });

  // Crear caso
  app.post("/v1/cases", async (req, reply) => {
    const parse = CreateCaseSchema.safeParse(req.body);
    if (!parse.success) return reply.status(400).send({ error: parse.error.flatten() });
    const { client_id, title, status } = parse.data;
    const tenantId = await getDefaultTenantId();

    // Verifica que el cliente sea del tenant
    const ok = await pool.query(`SELECT 1 FROM clients WHERE id=$1 AND tenant_id=$2`, [client_id, tenantId]);
    if (ok.rowCount === 0) return reply.status(404).send({ error: "client_not_found" });

    const ins = await pool.query<{ id: string }>(
      `INSERT INTO cases (tenant_id, client_id, title, status) VALUES ($1,$2,$3,$4) RETURNING id::text`,
      [tenantId, client_id, title.trim(), status ?? "open"]
    );
    return reply.status(201).send({ id: ins.rows[0].id });
  });
}
