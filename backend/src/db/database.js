import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});

function normalizeRow(row) {
  if (!row) return row;
  const out = { ...row };
  for (const [key, value] of Object.entries(out)) {
    if (value instanceof Date) {
      out[key] = value.toISOString().split('T')[0];
    } else if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) {
      out[key] = Number(value);
    }
  }
  return out;
}

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function getOne(text, params = []) {
  const res = await pool.query(text, params);
  return normalizeRow(res.rows[0]) || null;
}

export async function getAll(text, params = []) {
  const res = await pool.query(text, params);
  return res.rows.map(normalizeRow);
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(schema);

  // Migraciones ligeras (tablas ya existentes)
  const migraciones = [
    `ALTER TABLE compras ADD COLUMN IF NOT EXISTS pagado_desde_caja BOOLEAN DEFAULT TRUE`,
    `ALTER TABLE lives ADD COLUMN IF NOT EXISTS titulo TEXT`,
    `ALTER TABLE lives ADD COLUMN IF NOT EXISTS plataforma TEXT DEFAULT 'tiktok'`,
    `ALTER TABLE lives ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'finalizado'`,
  ];
  for (const sql of migraciones) {
    try { await pool.query(sql); } catch { /* ya aplicada o no aplica */ }
  }
}

export { pool };
