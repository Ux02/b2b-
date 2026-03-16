import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

const dbPath = path.resolve(process.cwd(), 'data/db.json');
const usePg = Boolean(process.env.DATABASE_URL);

const defaultDb = {
  leads: [],
  emailLogs: [],
  templates: []
};

let pool;
let pgReady = false;

async function ensurePg() {
  if (!usePg) return;
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  if (pgReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(
    `INSERT INTO app_state (id, data)
     VALUES (1, $1::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [JSON.stringify(defaultDb)]
  );

  pgReady = true;
}

export async function readDb() {
  if (usePg) {
    await ensurePg();
    const { rows } = await pool.query('SELECT data FROM app_state WHERE id = 1 LIMIT 1');
    const data = rows?.[0]?.data || defaultDb;
    return {
      leads: Array.isArray(data.leads) ? data.leads : [],
      emailLogs: Array.isArray(data.emailLogs) ? data.emailLogs : [],
      templates: Array.isArray(data.templates) ? data.templates : []
    };
  }

  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify(defaultDb, null, 2));
    return structuredClone(defaultDb);
  }
  return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
}

export async function writeDb(db) {
  if (usePg) {
    await ensurePg();
    await pool.query(
      'UPDATE app_state SET data = $1::jsonb, updated_at = NOW() WHERE id = 1',
      [JSON.stringify(db)]
    );
    return;
  }

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

export function id(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
