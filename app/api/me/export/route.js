import { getUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';

// Member data export (Australian Privacy Principle 12 - access to personal information).
export async function GET() {
  const me = await getUser();
  if (!me) return new Response('Unauthorised', { status: 401 });
  const db = getDb();
  const q = (sql) => db.prepare(sql).all(me.id);
  const { expires_at, ...profile } = me;
  const data = {
    exported_at: new Date().toISOString(),
    profile,
    bookings: q(`SELECT b.status, b.created_at, cs.starts_at, ct.name AS class FROM bookings b JOIN class_sessions cs ON cs.id=b.session_id JOIN class_types ct ON ct.id=cs.class_type_id WHERE b.user_id=? ORDER BY cs.starts_at`),
    workouts: db.prepare('SELECT * FROM workouts WHERE user_id=? ORDER BY date').all(me.id).map((w) => ({ ...w, sets: db.prepare('SELECT exercise, sets, reps, weight_kg FROM workout_sets WHERE workout_id=?').all(w.id) })),
    food_entries: q('SELECT date, meal, description, calories, protein_g, carbs_g, fat_g FROM food_entries WHERE user_id=? ORDER BY date'),
    measurements: q('SELECT date, body_fat_pct, waist_cm, chest_cm, hips_cm FROM measurements WHERE user_id=? ORDER BY date'),
    notes: q('SELECT date, body FROM notes WHERE user_id=? ORDER BY date'),
    programs: q('SELECT title, details, created_at FROM programs WHERE client_id=?'),
    trainer_notes_shared_with_you: q('SELECT body, created_at FROM trainer_notes WHERE client_id=? AND shared_with_client=1'),
    memberships: q('SELECT p.name, m.starts_on, m.ends_on, m.credits_remaining FROM memberships m JOIN plans p ON p.id=m.plan_id WHERE m.user_id=?'),
    payments: q('SELECT p.name AS plan, amount_cents, currency, provider, status, created_at FROM payments JOIN plans p ON p.id=payments.plan_id WHERE user_id=?'),
  };
  audit(me, 'member.data_export', `user:${me.id}`);
  return new Response(JSON.stringify(data, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="dodds-fitness-my-data-${new Date().toISOString().slice(0, 10)}.json"`, 'Cache-Control': 'no-store' },
  });
}
