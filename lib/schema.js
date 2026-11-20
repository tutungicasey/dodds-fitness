export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','trainer','admin')),
  phone TEXT, dob TEXT, goals TEXT, emergency_contact TEXT, injuries TEXT,
  trainer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,               -- sha256 of the cookie token (raw token never stored)
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS class_types (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  trainer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,          -- HH:MM Melbourne local
  duration_min INTEGER NOT NULL DEFAULT 45,
  capacity INTEGER NOT NULL,
  recurring INTEGER NOT NULL DEFAULT 1,
  first_date TEXT,                   -- for one-off classes
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS class_sessions (
  id INTEGER PRIMARY KEY,
  class_type_id INTEGER NOT NULL REFERENCES class_types(id) ON DELETE CASCADE,
  starts_at TEXT NOT NULL,           -- 'YYYY-MM-DD HH:MM' Melbourne local
  duration_min INTEGER NOT NULL,
  capacity INTEGER NOT NULL,
  trainer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  cancelled INTEGER NOT NULL DEFAULT 0,
  UNIQUE (class_type_id, starts_at)
);
CREATE INDEX IF NOT EXISTS idx_sessions_start ON class_sessions(starts_at);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('booked','waitlist','cancelled','attended','no_show')),
  credit_used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (session_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL, title TEXT NOT NULL, notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS workout_sets (
  id INTEGER PRIMARY KEY,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise TEXT NOT NULL, sets INTEGER NOT NULL, reps INTEGER NOT NULL, weight_kg REAL
);
CREATE TABLE IF NOT EXISTS food_entries (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL, meal TEXT NOT NULL, description TEXT NOT NULL,
  calories INTEGER, protein_g REAL, carbs_g REAL, fat_g REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS measurements (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL, body_fat_pct REAL, waist_cm REAL, chest_cm REAL, hips_cm REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL, body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS trainer_notes (
  id INTEGER PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trainer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL, shared_with_client INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS programs (
  id INTEGER PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trainer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL, details TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('membership','pack')),
  price_cents INTEGER NOT NULL, duration_days INTEGER, credits INTEGER,
  description TEXT, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- kept (anonymised) for accounting if member deletes account
  plan_id INTEGER REFERENCES plans(id),
  amount_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'AUD',
  provider TEXT NOT NULL CHECK (provider IN ('stripe','demo')),
  status TEXT NOT NULL CHECK (status IN ('pending','paid','failed','cancelled')),
  stripe_session_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT
);
CREATE TABLE IF NOT EXISTS memberships (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES plans(id),
  payment_id INTEGER REFERENCES payments(id),
  starts_on TEXT NOT NULL, ends_on TEXT, credits_remaining INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  actor_id INTEGER, actor_email TEXT,
  action TEXT NOT NULL, target TEXT, details TEXT, ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
`;
