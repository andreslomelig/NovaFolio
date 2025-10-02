import { FastifyInstance } from 'fastify';
import { pool } from '../db.js';

export async function clientsRoutes(app: FastifyInstance) {
  app.get('/v1/clients', async (req) => {
    const { q } = (req.query as { q?: string }) || {};
    const params:any[] = []; let where = '1=1';
    if (q && q.trim().length > 0) {
      params.push(q.toLowerCase() + '%', q.toLowerCase());
      where = `lower(name) LIKE $1 OR similarity(lower(name), $2) > 0.3`;
    }
    const { rows } = await pool.query(
      `SELECT id::text, name, created_at FROM clients WHERE ${where} ORDER BY name ASC LIMIT 50`, params
    );
    return { items: rows };
  });
}
