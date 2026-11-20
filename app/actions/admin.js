'use server';
import { z } from 'zod';
import { getDb, generateSessions } from '@/lib/db';
import { requireUser, clientIp, canAccessClient } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { run, str, withParam } from '@/lib/action';
import { isValidDate, nowLocal } from '@/lib/time';

export async function createClassAction(fd) {
  await run(fd, async () => {
    const me = await requireUser(['admin']);
    const recurring = str(fd, 'recurring') === 'on';
    const c = z.object({
      name: z.string().trim().min(2, 'Class name required').max(60),
      description: z.string().max(300),
      trainer_id: z.coerce.number().int().positive('Choose a trainer'),
      day_of_week: z.coerce.number().int().min(0).max(6),
      start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must be HH:MM'),
      duration_min: z.coerce.number().int().min(10).max(240),
      capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1').max(200),
      first_date: z.string().refine((v) => recurring || isValidDate(v), 'One-off classes need a date'),
    }).parse(Object.fromEntries(['name', 'description', 'trainer_id', 'day_of_week', 'start_time', 'duration_min', 'capacity', 'first_date'].map((k) => [k, str(fd, k)])));
    const db = getDb();
    const tr = db.prepare("SELECT id FROM users WHERE id = ? AND role IN ('trainer','admin')").get(c.trainer_id);
    if (!tr) throw new Error('Trainer not found');
    const dow = recurring ? c.day_of_week : new Date(c.first_date + 'T00:00:00Z').getUTCDay();
    const id = db.prepare(`INSERT INTO class_types (name, description, trainer_id, day_of_week, start_time, duration_min, capacity, recurring, first_date)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(c.name, c.description || null, c.trainer_id, dow, c.start_time, c.duration_min, c.capacity, recurring ? 1 : 0, recurring ? null : c.first_date).lastInsertRowid;
    generateSessions(db);
    audit(me, 'admin.class_create', `class_type:${id}`, { ...c, recurring }, await clientIp());
    return '/admin/classes?msg=' + encodeURIComponent(`Class "${c.name}" created and added to the timetable.`);
  });
}

export async function deactivateClassAction(fd) {
  await run(fd, async () => {
    const me = await requireUser(['admin']);
    const id = Number(fd.get('class_type_id'));
    const db = getDb();
    db.prepare('UPDATE class_types SET active = 0 WHERE id = ?').run(id);
    const r = db.prepare('UPDATE class_sessions SET cancelled = 1 WHERE class_type_id = ? AND starts_at > ?').run(id, nowLocal());
    audit(me, 'admin.class_deactivate', `class_type:${id}`, { future_sessions_cancelled: r.changes }, await clientIp());
    return '/admin/classes?msg=' + encodeURIComponent('Class deactivated and future sessions cancelled.');
  });
}

export async function cancelSessionAction(fd) {
  await run(fd, async (back) => {
    const me = await requireUser(['admin']);
    const id = Number(fd.get('session_id'));
    getDb().prepare('UPDATE class_sessions SET cancelled = 1 WHERE id = ?').run(id);
    audit(me, 'admin.session_cancel', `session:${id}`, null, await clientIp()); // TODO: notify booked members
    return withParam(back, 'msg', 'Session cancelled.');
  });
}

export async function setRoleAction(fd) {
  await run(fd, async () => {
    const me = await requireUser(['admin']);
    const id = Number(fd.get('user_id'));
    const role = z.enum(['member', 'trainer', 'admin']).parse(str(fd, 'role'));
    if (id === me.id) throw new Error('You cannot change your own role.');
    const db = getDb();
    const before = db.prepare('SELECT role, email FROM users WHERE id = ?').get(id);
    if (!before) throw new Error('User not found');
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id); // force re-login with new privileges
    audit(me, 'admin.role_change', `user:${id}`, { email: before.email, from: before.role, to: role }, await clientIp());
    return '/admin/members?msg=' + encodeURIComponent(`Role updated to ${role}.`);
  });
}

export async function assignTrainerAction(fd) {
  await run(fd, async () => {
    const me = await requireUser(['admin']);
    const id = Number(fd.get('user_id'));
    const tid = str(fd, 'trainer_id') ? Number(fd.get('trainer_id')) : null;
    const db = getDb();
    if (tid && !db.prepare("SELECT 1 FROM users WHERE id = ? AND role IN ('trainer','admin')").get(tid)) throw new Error('Trainer not found');
    db.prepare('UPDATE users SET trainer_id = ? WHERE id = ?').run(tid, id);
    audit(me, 'admin.trainer_assign', `user:${id}`, { trainer_id: tid }, await clientIp());
    return '/admin/members?msg=' + encodeURIComponent('Trainer assignment saved.');
  });
}

export async function markAttendanceAction(fd) {
  await run(fd, async (back) => {
    const me = await requireUser(['admin', 'trainer']);
    const status = z.enum(['attended', 'no_show', 'booked']).parse(str(fd, 'status'));
    const db = getDb();
    const b = db.prepare('SELECT b.*, cs.trainer_id FROM bookings b JOIN class_sessions cs ON cs.id = b.session_id WHERE b.id = ?').get(Number(fd.get('booking_id')));
    if (!b) throw new Error('Booking not found');
    if (me.role === 'trainer' && b.trainer_id !== me.id) throw new Error('You can only mark attendance for your own classes.');
    if (!['booked', 'attended', 'no_show'].includes(b.status)) throw new Error('Only confirmed bookings can be marked.');
    db.prepare("UPDATE bookings SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, b.id);
    audit(me, 'staff.attendance', `booking:${b.id}`, { status }, await clientIp());
    return withParam(back, 'msg', 'Attendance updated.');
  });
}

async function clientFor(fd) {
  const me = await requireUser(['admin', 'trainer']);
  const client = getDb().prepare('SELECT * FROM users WHERE id = ?').get(Number(fd.get('client_id')));
  if (!canAccessClient(me, client)) throw new Error('You do not have access to this client.');
  return { me, client };
}

export async function addTrainerNoteAction(fd) {
  await run(fd, async (back) => {
    const { me, client } = await clientFor(fd);
    const body = z.string().trim().min(1, 'Note is empty').max(2000).parse(str(fd, 'body'));
    const shared = str(fd, 'shared') === 'on' ? 1 : 0;
    getDb().prepare('INSERT INTO trainer_notes (client_id, trainer_id, body, shared_with_client) VALUES (?,?,?,?)').run(client.id, me.id, body, shared);
    audit(me, 'trainer.note_add', `user:${client.id}`, { shared: !!shared }, await clientIp());
    return withParam(back, 'msg', 'Trainer note added.');
  });
}

export async function addProgramAction(fd) {
  await run(fd, async (back) => {
    const { me, client } = await clientFor(fd);
    const p = z.object({ title: z.string().trim().min(2, 'Program title required').max(100), details: z.string().trim().min(1, 'Program details required').max(4000) })
      .parse({ title: str(fd, 'title'), details: str(fd, 'details') });
    getDb().prepare('INSERT INTO programs (client_id, trainer_id, title, details) VALUES (?,?,?,?)').run(client.id, me.id, p.title, p.details);
    audit(me, 'trainer.program_assign', `user:${client.id}`, { title: p.title }, await clientIp());
    return withParam(back, 'msg', 'Program assigned to client.');
  });
}
