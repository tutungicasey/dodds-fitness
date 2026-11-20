import { getDb } from './db.js';
import { nowLocal } from './time.js';
import { entitlements } from './membership.js';

export function sessionCounts(sessionId) {
  return getDb().prepare(`SELECT
      SUM(CASE WHEN status IN ('booked','attended','no_show') THEN 1 ELSE 0 END) AS booked,
      SUM(CASE WHEN status = 'waitlist' THEN 1 ELSE 0 END) AS waitlist
    FROM bookings WHERE session_id = ?`).get(sessionId);
}

/** Book a member into a session, or waitlist if full. Returns { status } or throws Error(message). */
export function bookSession(userId, sessionId) {
  const db = getDb();
  return db.transaction(() => {
    const s = db.prepare('SELECT * FROM class_sessions WHERE id = ?').get(sessionId);
    if (!s || s.cancelled) throw new Error('That class is not available.');
    if (s.starts_at <= nowLocal()) throw new Error('That class has already started.');
    const existing = db.prepare('SELECT * FROM bookings WHERE session_id = ? AND user_id = ?').get(sessionId, userId);
    if (existing && ['booked', 'waitlist'].includes(existing.status)) throw new Error('You are already on this class.');
    const ent = entitlements(userId);
    if (!ent.canBook) throw new Error('NO_ENTITLEMENT');
    const { booked } = sessionCounts(sessionId);
    const status = (booked || 0) < s.capacity ? 'booked' : 'waitlist';
    let creditUsed = 0;
    if (status === 'booked' && !ent.unlimited) {
      const pack = ent.packs[0];
      db.prepare('UPDATE memberships SET credits_remaining = credits_remaining - 1 WHERE id = ?').run(pack.id);
      creditUsed = pack.id;
    }
    if (existing) {
      db.prepare("UPDATE bookings SET status = ?, credit_used = ?, created_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(status, creditUsed, existing.id);
    } else {
      db.prepare('INSERT INTO bookings (session_id, user_id, status, credit_used) VALUES (?,?,?,?)').run(sessionId, userId, status, creditUsed);
    }
    return { status };
  })();
}

/** Cancel a booking; refunds a pack credit and promotes the first waitlisted member. */
export function cancelBooking(userId, sessionId) {
  const db = getDb();
  return db.transaction(() => {
    const b = db.prepare('SELECT * FROM bookings WHERE session_id = ? AND user_id = ?').get(sessionId, userId);
    if (!b || !['booked', 'waitlist'].includes(b.status)) throw new Error('No active booking to cancel.');
    const s = db.prepare('SELECT * FROM class_sessions WHERE id = ?').get(sessionId);
    if (s.starts_at <= nowLocal()) throw new Error('That class has already started.');
    db.prepare("UPDATE bookings SET status = 'cancelled', credit_used = 0, updated_at = datetime('now') WHERE id = ?").run(b.id);
    if (b.credit_used) db.prepare('UPDATE memberships SET credits_remaining = credits_remaining + 1 WHERE id = ?').run(b.credit_used);
    let promoted = null;
    if (b.status === 'booked') {
      const next = db.prepare("SELECT * FROM bookings WHERE session_id = ? AND status = 'waitlist' ORDER BY created_at, id LIMIT 1").get(sessionId);
      if (next) {
        const ent = entitlements(next.user_id);
        let creditUsed = 0;
        if (!ent.unlimited && ent.packs[0]) {
          db.prepare('UPDATE memberships SET credits_remaining = credits_remaining - 1 WHERE id = ?').run(ent.packs[0].id);
          creditUsed = ent.packs[0].id;
        }
        db.prepare("UPDATE bookings SET status = 'booked', credit_used = ?, updated_at = datetime('now') WHERE id = ?").run(creditUsed, next.id);
        promoted = next.user_id; // TODO: email/push notification to promoted member
      }
    }
    return { promoted };
  })();
}

export function upcomingSessions(fromLocal, toLocal, userId) {
  return getDb().prepare(`SELECT cs.*, ct.name, ct.description, u.name AS trainer_name,
      (SELECT COUNT(*) FROM bookings b WHERE b.session_id = cs.id AND b.status IN ('booked','attended','no_show')) AS booked,
      (SELECT COUNT(*) FROM bookings b WHERE b.session_id = cs.id AND b.status = 'waitlist') AS waitlist,
      (SELECT status FROM bookings b WHERE b.session_id = cs.id AND b.user_id = ?) AS my_status
    FROM class_sessions cs JOIN class_types ct ON ct.id = cs.class_type_id LEFT JOIN users u ON u.id = cs.trainer_id
    WHERE cs.starts_at >= ? AND cs.starts_at < ? AND cs.cancelled = 0 ORDER BY cs.starts_at`).all(userId ?? -1, fromLocal, toLocal);
}
