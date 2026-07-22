import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../../data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'bombastic.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

// Migraciones ligeras
const migraciones = [
  `ALTER TABLE compras ADD COLUMN es_caja INTEGER DEFAULT 1`,
  `ALTER TABLE clientes ADD COLUMN total_comprado REAL DEFAULT 0`,
  `ALTER TABLE clientes ADD COLUMN cantidad_compras INTEGER DEFAULT 0`,
  `ALTER TABLE clientes ADD COLUMN ultima_compra TEXT`,
];
for (const sql of migraciones) {
  try { db.exec(sql); } catch { /* ya aplicada */ }
}

export default db;

export function getDbPath() {
  return dbPath;
}
