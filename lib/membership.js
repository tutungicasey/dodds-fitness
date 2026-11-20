import { getDb } from './db.js';
import { today, addDays } from './time.js';

/** Active entitlements for a member: unlimited membership and/or class-pack credits. */
export function entitlements(userId) {
  const db = getDb();
  const t = today();
  const rows = db.prepare(`SELECT m.*, p.name, p.kind FROM memberships m JOIN plans p ON p.id = m.plan_id
    WHERE m.user_id = ? AND m.starts_on <= ? AND (m.ends_on IS NULL OR m.ends_on >= ?) ORDER BY m.ends_on`).all(userId, t, t);
  const unlimited = rows.find((r) => r.kind === 'membership') || null;
  const packs = rows.filter((r) => r.kind === 'pack' && r.credits_remaining > 0);
  const credits = packs.reduce((s, p) => s + p.credits_remaining, 0);
  return { unlimited, packs, credits, canBook: !!unlimited || credits > 0 };
}

/** Grant a plan to a member after a successful (demo or Stripe) payment. Idempotent per payment. */
export function grantPlan(paymentId) {
  const db = getDb();
  const pay = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
  if (!pay || pay.status !== 'paid') return;
  if (db.prepare('SELECT 1 FROM memberships WHERE payment_id = ?').get(paymentId)) return;
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(pay.plan_id);
  let start = today();
  if (plan.kind === 'membership') {
    const cur = db.prepare(`SELECT m.ends_on FROM memberships m JOIN plans p ON p.id = m.plan_id
      WHERE m.user_id = ? AND p.kind = 'membership' AND m.ends_on >= ? ORDER BY m.ends_on DESC LIMIT 1`).get(pay.user_id, start);
    if (cur) start = addDays(cur.ends_on, 1); // extend rather than overlap
  }
  db.prepare('INSERT INTO memberships (user_id, plan_id, payment_id, starts_on, ends_on, credits_remaining) VALUES (?,?,?,?,?,?)')
    .run(pay.user_id, plan.id, pay.id, start, plan.duration_days ? addDays(start, plan.duration_days) : null, plan.credits ?? null);
}
