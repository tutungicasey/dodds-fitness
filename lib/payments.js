import { getDb } from './db.js';
import { grantPlan } from './membership.js';

/** Mark a payment as paid (idempotent) and grant the purchased plan. */
export function markPaid(paymentId) {
  const db = getDb();
  db.transaction(() => {
    const r = db.prepare("UPDATE payments SET status = 'paid', paid_at = datetime('now') WHERE id = ? AND status = 'pending'").run(paymentId);
    if (r.changes) grantPlan(paymentId);
  })();
}
