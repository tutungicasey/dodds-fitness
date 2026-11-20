import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { addDays, today, dow } from './time.js';

// Documented DEMO credentials (also in README). For demonstration only.
export const DEMO_ACCOUNTS = [
  { email: 'admin@doddsfitness.demo', password: 'DemoAdmin!2026', name: 'Casey Tutungi (Demo Admin)', role: 'admin' },
  { email: 'trainer@doddsfitness.demo', password: 'DemoTrainer!2026', name: 'Jordan Lee (Demo Trainer)', role: 'trainer' },
  { email: 'member@doddsfitness.demo', password: 'DemoMember!2026', name: 'Alex Rivera (Demo Member)', role: 'member' },
];

const FIRST = ['Mia', 'Noah', 'Olivia', 'Liam', 'Charlotte', 'Jack', 'Amelia', 'William', 'Isla', 'Oliver', 'Ava', 'Thomas', 'Grace', 'Lucas', 'Chloe', 'Henry', 'Zoe', 'Leo', 'Ruby', 'Hamish', 'Sienna', 'Archie', 'Matilda', 'Ethan', 'Harper', 'Kai', 'Ivy', 'Mason'];
const LAST = ['Nguyen', 'Smith', 'Papadopoulos', 'Wilson', 'Tran', 'Brown', 'Singh', 'Taylor', 'Kelly', 'Rossi', 'Chen', 'Walker'];

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export function seedDemo(db) {
  const r = rng(20261120);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const tx = db.transaction(() => {
    const insUser = db.prepare(`INSERT INTO users (email, password_hash, name, role, phone, goals, is_demo, trainer_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`);
    const ids = {};
    for (const a of DEMO_ACCOUNTS) {
      ids[a.role] = insUser.run(a.email, bcrypt.hashSync(a.password, 12), a.name, a.role, '0400 000 000',
        a.role === 'member' ? 'Build strength, run a 10k by March' : null, null, addDays(today(), -120) + ' 09:00:00').lastInsertRowid;
    }
    const trainer2 = insUser.run('sam.trainer@doddsfitness.demo', unusableHash(), 'Sam Okafor (Demo Trainer)', 'trainer', null, null, null, addDays(today(), -200) + ' 09:00:00').lastInsertRowid;
    db.prepare('UPDATE users SET trainer_id = ? WHERE id = ?').run(ids.trainer, ids.member);

    // Demo members (cannot log in: random unusable password hash)
    const members = [ids.member];
    for (let i = 0; i < 28; i++) {
      const fn = FIRST[i % FIRST.length], ln = pick(LAST);
      const id = insUser.run(`${fn.toLowerCase()}.${ln.toLowerCase()}${i}@example.demo`, unusableHash(), `${fn} ${ln} (Demo)`, 'member', null, null,
        r() < 0.5 ? ids.trainer : trainer2, addDays(today(), -Math.floor(r() * 150)) + ' 10:00:00').lastInsertRowid;
      members.push(id);
    }

    // Plans (AUD, GST inclusive)
    const insPlan = db.prepare('INSERT INTO plans (name, kind, price_cents, duration_days, credits, description) VALUES (?,?,?,?,?,?)');
    const pMonthly = insPlan.run('Monthly Unlimited', 'membership', 8900, 30, null, 'Unlimited classes for 30 days').lastInsertRowid;
    const pAnnual = insPlan.run('Annual Unlimited', 'membership', 89900, 365, null, 'Unlimited classes for 12 months (save ~16%)').lastInsertRowid;
    const pPack = insPlan.run('10-Class Pack', 'pack', 18000, 180, 10, '10 class credits, valid 6 months').lastInsertRowid;
    const pCasual = insPlan.run('Casual Class', 'pack', 2500, 30, 1, 'Single class credit, valid 30 days').lastInsertRowid;
    const planRows = { [pMonthly]: 8900, [pAnnual]: 89900, [pPack]: 18000, [pCasual]: 2500 };

    // Classes (weekly recurring). day_of_week: 0=Sun
    const insType = db.prepare(`INSERT INTO class_types (name, description, trainer_id, day_of_week, start_time, duration_min, capacity, recurring)
      VALUES (?,?,?,?,?,?,?,1)`);
    const classes = [
      ['HIIT', 'High-intensity intervals, all levels', ids.trainer, 1, '06:00', 45, 16, 0.92],
      ['HIIT', 'High-intensity intervals, all levels', ids.trainer, 3, '06:00', 45, 16, 0.88],
      ['HIIT', 'High-intensity intervals, all levels', trainer2, 5, '06:00', 45, 16, 0.8],
      ['Spin', 'Indoor cycling to a playlist', trainer2, 2, '06:30', 45, 20, 0.85],
      ['Spin', 'Indoor cycling to a playlist', trainer2, 4, '18:00', 45, 20, 0.75],
      ['Spin', 'Weekend ride', trainer2, 6, '08:00', 60, 20, 0.95],
      ['Yoga', 'Vinyasa flow & mobility', ids.trainer, 3, '18:30', 60, 15, 0.7],
      ['Yoga', 'Slow Sunday flow', ids.trainer, 0, '09:00', 60, 15, 0.6],
      ['Strength', 'Barbell & dumbbell strength', ids.trainer, 1, '17:30', 60, 12, 0.78],
      ['Strength', 'Barbell & dumbbell strength', trainer2, 4, '17:30', 60, 12, 0.7],
    ];
    const typeIds = classes.map((c) => ({ id: insType.run(...c.slice(0, 7)).lastInsertRowid, pop: c[7], cap: c[6], dow: c[3], time: c[4], dur: c[5], trainer: c[2] }));

    // Sessions: 6 weeks history + 3 weeks ahead
    const insSess = db.prepare('INSERT INTO class_sessions (class_type_id, starts_at, duration_min, capacity, trainer_id) VALUES (?,?,?,?,?)');
    const insBook = db.prepare('INSERT OR IGNORE INTO bookings (session_id, user_id, status, created_at, updated_at) VALUES (?,?,?,?,?)');
    const t0 = today();
    for (let i = -42; i < 21; i++) {
      const d = addDays(t0, i);
      for (const t of typeIds) {
        if (dow(d) !== t.dow) continue;
        const sid = insSess.run(t.id, `${d} ${t.time}`, t.dur, t.cap, t.trainer).lastInsertRowid;
        const future = i >= 0;
        const fill = future ? t.pop * Math.max(0.2, 1 - i / 21) : t.pop;
        let n = Math.min(t.cap + (t.pop > 0.85 ? 3 : 0), Math.round(t.cap * fill * (0.85 + r() * 0.3)));
        if (future && i <= 5 && t.pop >= 0.88) n = t.cap + 2; // popular classes this week are full with a waitlist
        const shuffled = [...members].sort(() => r() - 0.5);
        const pool = shuffled.filter((uid) => !(future && uid === ids.member)); // demo member books their own future classes
        for (let k = 0; k < Math.min(n, pool.length); k++) {
          const uid = pool[k];
          let status;
          if (k >= t.cap) status = future ? 'waitlist' : 'cancelled';
          else if (future) status = 'booked';
          else status = r() < 0.88 ? 'attended' : 'no_show';
          const ts = addDays(d, -Math.ceil(r() * 5)) + ' 12:00:00';
          insBook.run(sid, uid, status, ts, ts);
        }
      }
    }

    // Payments & memberships over last ~90 days
    const insPay = db.prepare(`INSERT INTO payments (user_id, plan_id, amount_cents, provider, status, created_at, paid_at) VALUES (?,?,?,'demo','paid',?,?)`);
    const insMem = db.prepare('INSERT INTO memberships (user_id, plan_id, payment_id, starts_on, ends_on, credits_remaining) VALUES (?,?,?,?,?,?)');
    for (const uid of members) {
      const planId = uid === ids.member ? pMonthly : pick([pMonthly, pMonthly, pMonthly, pPack, pCasual, pAnnual]);
      const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
      if (plan.kind === 'membership' && plan.duration_days === 30) {
        for (let m = 2; m >= 0; m--) {
          const d = addDays(t0, -m * 30 - Math.floor(r() * 10));
          const pid = insPay.run(uid, planId, planRows[planId], d + ' 08:00:00', d + ' 08:00:00').lastInsertRowid;
          insMem.run(uid, planId, pid, d, addDays(d, 30), null);
        }
      } else {
        const d = addDays(t0, -Math.floor(r() * 80));
        const pid = insPay.run(uid, planId, planRows[planId], d + ' 08:00:00', d + ' 08:00:00').lastInsertRowid;
        insMem.run(uid, planId, pid, d, addDays(d, plan.duration_days), plan.credits ? Math.max(1, Math.floor(plan.credits * r())) : null);
      }
    }

    // Demo member diary
    const m = ids.member;
    const insW = db.prepare('INSERT INTO workouts (user_id, date, title, notes) VALUES (?,?,?,?)');
    const insS = db.prepare('INSERT INTO workout_sets (workout_id, exercise, sets, reps, weight_kg) VALUES (?,?,?,?,?)');
    for (let w = 0; w < 8; w++) {
      const d = addDays(t0, -56 + w * 7);
      const wid = insW.run(m, d, 'Lower body strength', w === 7 ? 'Felt strong, new squat PB!' : null).lastInsertRowid;
      insS.run(wid, 'Back squat', 4, 6, 60 + w * 2.5);
      insS.run(wid, 'Romanian deadlift', 3, 8, 50 + w * 2.5);
      insS.run(wid, 'Walking lunge', 3, 12, 12);
      const wid2 = insW.run(m, addDays(d, 3), 'Upper body push/pull', null).lastInsertRowid;
      insS.run(wid2, 'Bench press', 4, 6, 40 + w * 1.25);
      insS.run(wid2, 'Bent-over row', 4, 8, 40 + w * 1.25);
    }
    const insM = db.prepare('INSERT INTO measurements (user_id, date, body_fat_pct, waist_cm, chest_cm, hips_cm) VALUES (?,?,?,?,?,?)');
    for (let w = 0; w < 9; w++) insM.run(m, addDays(t0, -56 + w * 7), +(24 - w * 0.3).toFixed(1), +(90 - w * 0.5).toFixed(1), 101, 99);
    const insF = db.prepare('INSERT INTO food_entries (user_id, date, meal, description, calories, protein_g, carbs_g, fat_g) VALUES (?,?,?,?,?,?,?,?)');
    for (let i = 0; i < 4; i++) {
      const d = addDays(t0, -i);
      insF.run(m, d, 'Breakfast', 'Oats, banana, Greek yoghurt', 520, 28, 78, 10);
      insF.run(m, d, 'Lunch', 'Chicken & rice bowl', 680, 48, 80, 16);
      insF.run(m, d, 'Dinner', 'Salmon, sweet potato, greens', 640, 42, 50, 26);
      insF.run(m, d, 'Snack', 'Protein shake', 180, 30, 6, 3);
    }
    db.prepare('INSERT INTO notes (user_id, date, body) VALUES (?,?,?)').run(m, addDays(t0, -2), 'Left knee a bit sore after lunges - go lighter this week.');
    db.prepare('INSERT INTO trainer_notes (client_id, trainer_id, body, shared_with_client) VALUES (?,?,?,1)').run(m, ids.trainer, 'Great progress on squat depth. Next block: add paused squats.');
    db.prepare('INSERT INTO trainer_notes (client_id, trainer_id, body, shared_with_client) VALUES (?,?,?,0)').run(m, ids.trainer, 'Private: monitor left knee; consider physio referral if persists.');
    db.prepare('INSERT INTO programs (client_id, trainer_id, title, details) VALUES (?,?,?,?)').run(m, ids.trainer, '8-week Strength Foundations',
      'Day A: Back squat 4x6, RDL 3x8, Lunges 3x12\nDay B: Bench 4x6, Row 4x8, Plank 3x45s\nDay C: Spin or HIIT class\nProgress: +2.5kg per week when all reps completed.');
    db.prepare("INSERT INTO meta (key, value) VALUES ('seeded_at', datetime('now'))").run();
  });
  tx();
}

function unusableHash() { return '!demo-no-login!' + crypto.randomBytes(16).toString('hex'); }
