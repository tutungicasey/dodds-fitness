import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { today } from '@/lib/time';
import Flash from '@/components/Flash';
import Csrf from '@/components/Csrf';
import AdminNav from '@/components/AdminNav';
import { setRoleAction, assignTrainerAction } from '@/app/actions/admin';

export const metadata = { title: 'Members' };

export default async function Members({ searchParams }) {
  const me = await requireUser(['admin']);
  const sp = await searchParams;
  const db = getDb();
  const q = typeof sp.q === 'string' ? sp.q.slice(0, 60) : '';
  const t = today();
  const users = db.prepare(`SELECT u.*, t.name AS trainer,
      (SELECT p.name FROM memberships m JOIN plans p ON p.id = m.plan_id WHERE m.user_id = u.id AND m.starts_on <= ? AND m.ends_on >= ? AND (m.credits_remaining IS NULL OR m.credits_remaining > 0) ORDER BY m.ends_on DESC LIMIT 1) AS plan,
      (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id AND b.status IN ('booked','attended','no_show')) AS bookings
    FROM users u LEFT JOIN users t ON t.id = u.trainer_id WHERE (u.name LIKE ? OR u.email LIKE ?) ORDER BY u.role, u.name`).all(t, t, `%${q}%`, `%${q}%`);
  const trainers = db.prepare("SELECT id, name FROM users WHERE role IN ('trainer','admin') ORDER BY name").all();
  const H = () => <><Csrf /><input type="hidden" name="back" value="/admin/members" /></>;
  return (
    <>
      <Flash sp={sp} />
      <h1>Members &amp; staff</h1>
      <AdminNav active="/admin/members" />
      <form className="card actions" method="get"><input name="q" defaultValue={q} placeholder="Search name or email" style={{ maxWidth: 320 }} /><button className="btn btn-ghost">Search</button><span className="small muted">{users.length} people</span></form>
      <div className="card"><div className="table-wrap"><table className="t"><thead><tr><th>Name</th><th>Plan</th><th>Bookings</th><th>Trainer</th><th>Role</th></tr></thead><tbody>
        {users.map((u) => (
          <tr key={u.id}>
            <td>{u.role === 'member' ? <Link href={`/trainer/clients/${u.id}`}><strong>{u.name}</strong></Link> : <strong>{u.name}</strong>}<div className="small muted">{u.email}</div></td>
            <td className="small">{u.plan || <span className="muted">none</span>}</td>
            <td>{u.bookings}</td>
            <td>{u.role === 'member' && (
              <form action={assignTrainerAction} className="actions"><H /><input type="hidden" name="user_id" value={u.id} />
                <select name="trainer_id" defaultValue={u.trainer_id || ''} style={{ width: 'auto' }}><option value="">-</option>{trainers.map((t) => <option key={t.id} value={t.id}>{t.name.replace(/ \(Demo.*\)/, '')}</option>)}</select>
                <button className="btn btn-ghost btn-sm">Save</button></form>)}</td>
            <td>{u.id === me.id ? <span className={`role role-${u.role}`}>{u.role}</span> : (
              <form action={setRoleAction} className="actions"><H /><input type="hidden" name="user_id" value={u.id} />
                <select name="role" defaultValue={u.role} style={{ width: 'auto' }}>{['member', 'trainer', 'admin'].map((r) => <option key={r}>{r}</option>)}</select>
                <button className="btn btn-ghost btn-sm">Set</button></form>)}</td>
          </tr>
        ))}
      </tbody></table></div></div>
    </>
  );
}
