// src/db.ts
import pg from "pg";
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgres://novafolio:novafolio@localhost:5432/novafolio",
  max: 10,
  idleTimeoutMillis: 30_000,
});

/** Simple health check to DB */
export const pingDb = async (): Promise<boolean> => {
  try {
    const r = await pool.query("SELECT 1 AS ok");
    return r.rows?.[0]?.ok === 1;
  } catch (e) {
    return false;
  }
};
