import fs from 'fs';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'data/db.json');

const defaultDb = {
  leads: [],
  emailLogs: []
};

export function readDb() {
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify(defaultDb, null, 2));
    return structuredClone(defaultDb);
  }
  return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
}

export function writeDb(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

export function id(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
