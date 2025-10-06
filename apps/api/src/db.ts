// src/db.ts
import pg from "pg";
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgres://novafolio:novafolio@localhost:5432/novafolio",
  max: 10,
  idleTimeoutMillis: 30_000,
});

export const pingDb = async (): Promise<boolean> => {
  try { await pool.query("SELECT 1"); return true; } catch { return false; }
};

// --- Default tenant helpers ---
let CACHED_TENANT_ID: string | null = process.env.TENANT_ID ?? null;
const DEFAULT_TENANT_NAME = process.env.TENANT_NAME ?? "DemoTenant";

/** Creates DemoTenant if missing, returns its id (cached) */
export async function getDefaultTenantId(): Promise<string> {
  if (CACHED_TENANT_ID) return CACHED_TENANT_ID;

  const sel = await pool.query<{ id: string }>(
    "SELECT id FROM tenants WHERE name = $1 LIMIT 1",
    [DEFAULT_TENANT_NAME]
  );
  if (sel.rowCount && sel.rows[0]?.id) {
    CACHED_TENANT_ID = sel.rows[0].id;
    return CACHED_TENANT_ID;
  }
  const ins = await pool.query<{ id: string }>(
    "INSERT INTO tenants (name) VALUES ($1) RETURNING id",
    [DEFAULT_TENANT_NAME]
  );
  CACHED_TENANT_ID = ins.rows[0].id;
  return CACHED_TENANT_ID;
}
