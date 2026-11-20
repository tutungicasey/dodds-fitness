import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import crypto from 'node:crypto';
import { getDb } from './db.js';

export const SESSION_COOKIE = 'df_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function secureCookies() {
  if (process.env.COOKIE_SECURE) return process.env.COOKIE_SECURE === 'true';
  return process.env.NODE_ENV === 'production';
}
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export async function createSession(userId) {
  const db = getDb();
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), userId, Date.now() + MAX_AGE * 1000);
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: secureCookies(), path: '/', maxAge: MAX_AGE });
}

export async function destroySession() {
  const jar = await cookies();
  const t = jar.get(SESSION_COOKIE)?.value;
  if (t) getDb().prepare('DELETE FROM sessions WHERE id = ?').run(sha256(t));
  jar.delete(SESSION_COOKIE);
}

export const getUser = cache(async () => {
  const t = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!t) return null;
  const row = getDb().prepare(`SELECT u.id, u.email, u.name, u.role, u.phone, u.dob, u.goals, u.emergency_contact, u.injuries,
      u.trainer_id, u.is_demo, u.created_at, s.expires_at
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`).get(sha256(t));
  if (!row || row.expires_at < Date.now()) return null;
  return row;
});

export async function requireUser(roles) {
  const u = await getUser();
  if (!u) redirect('/login');
  if (roles && !roles.includes(u.role)) redirect('/dashboard?error=' + encodeURIComponent('You are not authorised to view that page.'));
  return u;
}

export async function clientIp() {
  const h = await headers();
  return (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || 'local';
}

/** Trainers may only access their assigned clients; admins may access everyone. */
export function canAccessClient(user, client) {
  if (!client) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'trainer') return client.trainer_id === user.id;
  return user.id === client.id;
}
