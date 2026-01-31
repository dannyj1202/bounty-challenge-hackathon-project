import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { initDb as runInitDb } from './init.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
const dbPath = join(dataDir, 'copilot.db');

let db = null;

export function getDb() {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    // Dev check: 1 = FKs enforced, 0 = documentation only
    if (process.env.NODE_ENV !== 'production') {
      console.log('FKs:', db.pragma('foreign_keys', { simple: true }));
    }
  }
  return db;
}

export function initDb() {
  return runInitDb();
}
