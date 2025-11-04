import { FastifyInstance } from 'fastify';
import { sql } from '../db';

export default async function searchRoutes(app: FastifyInstance) {
  app.get('/v1/search', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          case_id: { type: 'string', nullable: true },
          limit: { type: 'integer', default: 30, minimum: 1, maximum: 100 }
        },
        required: ['q']
      }
    }
  }, async (req, reply) => {
    const { q, case_id, limit } = req.query as { q: string; case_id?: string; limit: number };
    // Búsqueda combinada: trigram + full-text
    const rows = await sql/*sql*/`
      SELECT
        p.doc_id,
        p.page,
        substring(p.text from
          greatest(1, position(lower(${q}) in lower(p.text)) - 50)
          for 180
        ) AS snippet,
        d.name   AS doc_name,
        d.case_id
      FROM doc_pages p
      JOIN documents d ON d.id = p.doc_id
      WHERE (${case_id}::uuid IS NULL OR d.case_id = ${case_id})
        AND (p.text ILIKE '%' || ${q} || '%' OR p.tsv @@ websearch_to_tsquery('english', ${q}))
      ORDER BY similarity(p.text, ${q}) DESC NULLS LAST, p.page
      LIMIT ${limit};
    `;

    return { items: rows };
  });
}
