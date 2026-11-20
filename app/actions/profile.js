'use server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { requireUser, destroySession, clientIp } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { run, str } from '@/lib/action';
import { isValidDate } from '@/lib/time';

export async function updateProfileAction(fd) {
  await run(fd, async () => {
    const me = await requireUser();
    const p = z.object({
      name: z.string().trim().min(2, 'Name too short').max(80),
      phone: z.string().trim().max(30).regex(/^[0-9+() \-]*$/, 'Phone may only contain digits, spaces, + ( ) -'),
      dob: z.string().refine((v) => v === '' || isValidDate(v), 'Invalid date of birth'),
      goals: z.string().max(500), emergency: z.string().max(200), injuries: z.string().max(500),
    }).parse({ name: str(fd, 'name'), phone: str(fd, 'phone'), dob: str(fd, 'dob'), goals: str(fd, 'goals'), emergency: str(fd, 'emergency'), injuries: str(fd, 'injuries') });
    getDb().prepare('UPDATE users SET name=?, phone=?, dob=?, goals=?, emergency_contact=?, injuries=? WHERE id=?')
      .run(p.name, p.phone || null, p.dob || null, p.goals || null, p.emergency || null, p.injuries || null, me.id);
    return '/profile?msg=' + encodeURIComponent('Profile saved.');
  });
}

export async function deleteAccountAction(fd) {
  await run(fd, async () => {
    const me = await requireUser();
    const db = getDb();
    if (me.is_demo) throw new Error('Demo accounts cannot be deleted (so the demo keeps working). Sign up a new account to try deletion.');
    if (str(fd, 'confirm') !== 'DELETE') throw new Error('Type DELETE to confirm.');
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(me.id);
    if (!(await bcrypt.compare(str(fd, 'password'), row.password_hash))) throw new Error('Password is incorrect.');
    const ip = await clientIp();
    db.transaction(() => {
      // Payment records are retained without personal link for tax/accounting (ON DELETE SET NULL).
      db.prepare('DELETE FROM users WHERE id = ?').run(me.id); // cascades diary, bookings, sessions, notes
    })();
    audit({ id: me.id, email: '[deleted member]' }, 'member.self_delete', `user:${me.id}`, null, ip);
    await destroySession();
    return '/login?msg=' + encodeURIComponent('Your account and personal data have been deleted.');
  });
}
