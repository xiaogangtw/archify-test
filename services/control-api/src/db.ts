import pg from 'pg';
import { readFile } from 'node:fs/promises';
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
export async function migrate() { await pool.query(await readFile(new URL('../schema.sql', import.meta.url), 'utf8')); }
export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const value = await fn(client); await client.query('COMMIT'); return value; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
