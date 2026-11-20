import { getDb } from './db.js';
export function audit(actor, action, target = null, details = null, ip = null) {
  getDb().prepare('INSERT INTO audit_log (actor_id, actor_email, action, target, details, ip) VALUES (?,?,?,?,?,?)')
    .run(actor?.id ?? null, actor?.email ?? null, action, target, details ? JSON.stringify(details) : null, ip);
}
