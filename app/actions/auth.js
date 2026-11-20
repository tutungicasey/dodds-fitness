'use server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { createSession, destroySession, clientIp, getUser } from '@/lib/auth';
import { hit, clearKey } from '@/lib/ratelimit';
import { audit } from '@/lib/audit';
import { run, str } from '@/lib/action';

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(80),
  email: z.string().trim().toLowerCase().email('Please enter a valid email').max(160),
  password: z.string().min(10, 'Password must be at least 10 characters').max(128)
    .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Password must include letters and numbers'),
  consent: z.literal('on', { error: 'Please accept the privacy notice' }),
});

export async function signupAction(fd) {
  await run(fd, async () => {
    const ip = await clientIp();
    if (!hit(`signup:${ip}`, 10, 60 * 60 * 1000).ok) throw new Error('Too many sign-ups from this network. Try again later.');
    const data = signupSchema.parse({ name: str(fd, 'name'), email: str(fd, 'email'), password: str(fd, 'password'), consent: str(fd, 'consent') });
    const db = getDb();
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(data.email)) throw new Error('An account with that email already exists.');
    const hash = await bcrypt.hash(data.password, 12);
    const id = db.prepare("INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'member')").run(data.email, hash, data.name).lastInsertRowid;
    await createSession(id);
    audit({ id, email: data.email }, 'member.signup', `user:${id}`, null, ip);
    return '/dashboard?msg=' + encodeURIComponent('Welcome to Dodds Fitness! Choose a membership to start booking classes.');
  });
}

const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-password', 12);

export async function loginAction(fd) {
  await run(fd, async () => {
    const ip = await clientIp();
    const email = str(fd, 'email').trim().toLowerCase().slice(0, 160);
    const password = str(fd, 'password').slice(0, 128);
    const k1 = `login:${ip}:${email}`, k2 = `login-ip:${ip}`;
    const a = hit(k1, 5, 15 * 60 * 1000), b = hit(k2, 30, 15 * 60 * 1000);
    if (!a.ok || !b.ok) throw new Error(`Too many login attempts. Try again in ${Math.ceil(Math.max(a.retryAfterSec, b.retryAfterSec) / 60)} minutes.`);
    const u = getDb().prepare('SELECT * FROM users WHERE email = ?').get(email);
    const valid = await bcrypt.compare(password, u && u.password_hash.startsWith('$2') ? u.password_hash : DUMMY_HASH);
    if (!u || !valid) throw new Error('Incorrect email or password.');
    clearKey(k1);
    await createSession(u.id);
    if (u.role !== 'member') audit(u, 'staff.login', `user:${u.id}`, null, ip);
    return u.role === 'admin' ? '/admin' : u.role === 'trainer' ? '/trainer' : '/dashboard';
  });
}

export async function logoutAction(fd) {
  await run(fd, async () => { await destroySession(); return '/login?msg=' + encodeURIComponent('You have been logged out.'); });
}

export async function changePasswordAction(fd) {
  await run(fd, async () => {
    const me = await getUser();
    if (!me) return '/login';
    const db = getDb();
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(me.id);
    if (!(await bcrypt.compare(str(fd, 'current'), row.password_hash))) throw new Error('Current password is incorrect.');
    const pw = signupSchema.shape.password.parse(str(fd, 'new'));
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await bcrypt.hash(pw, 12), me.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(me.id);
    await createSession(me.id);
    return '/profile?msg=' + encodeURIComponent('Password updated. Other devices have been signed out.');
  });
}
