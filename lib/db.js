import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { SCHEMA } from './schema.js';
import { seedDemo } from './seed.js';
import { addDays, today, dow } from './time.js';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'dodds.db');

export function openDb(file = DB_PATH) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

/** Idempotent migrations for databases created by earlier versions. */
function migrate(db) {
  // 2026-11-20: body-weight tracking removed at the owner's request. Drop the column (and its data) cleanly.
  const cols = db.prepare('PRAGMA table_info(measurements)').all().map((c) => c.name);
  if (cols.includes('weight_kg')) db.exec('ALTER TABLE measurements DROP COLUMN weight_kg');
}

export function getDb() {
  let db = globalThis.__doddsDb;
  if (!db) {
    db = openDb();
    const n = db.prepare('SELECT COUNT(*) c FROM users').get().c;
    if (n === 0 && process.env.SEED_DEMO !== 'false') seedDemo(db);
    globalThis.__doddsDb = db;
  }
  const last = globalThis.__doddsGen || 0;
  if (Date.now() - last > 10 * 60 * 1000) { generateSessions(db); globalThis.__doddsGen = Date.now(); }
  return db;
}

/** Materialise recurring weekly classes into concrete sessions for the next N days. */
export function generateSessions(db, days = 21, from = today()) {
  const types = db.prepare('SELECT * FROM class_types WHERE active = 1').all();
  const ins = db.prepare(`INSERT OR IGNORE INTO class_sessions (class_type_id, starts_at, duration_min, capacity, trainer_id)
    VALUES (?, ?, ?, ?, ?)`);
  const tx = db.transaction(() => {
    for (const t of types) {
      if (!t.recurring) {
        if (t.first_date) ins.run(t.id, `${t.first_date} ${t.start_time}`, t.duration_min, t.capacity, t.trainer_id);
        continue;
      }
      for (let i = 0; i < days; i++) {
        const d = addDays(from, i);
        if (dow(d) === t.day_of_week) ins.run(t.id, `${d} ${t.start_time}`, t.duration_min, t.capacity, t.trainer_id);
      }
    }
  });
  tx();
}
