// Reset the database and re-seed demo data:  npm run seed
import fs from 'node:fs';
import path from 'node:path';
import { openDb, generateSessions } from '../lib/db.js';
import { seedDemo } from '../lib/seed.js';
const file = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'dodds.db');
for (const f of [file, file + '-wal', file + '-shm']) if (fs.existsSync(f)) fs.rmSync(f);
const db = openDb(file);
seedDemo(db);
generateSessions(db);
const c = (t) => db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
console.log(`Seeded ${file}: users=${c('users')} sessions=${c('class_sessions')} bookings=${c('bookings')} payments=${c('payments')}`);
