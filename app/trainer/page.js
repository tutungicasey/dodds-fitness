import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { nowLocal, addDays, today, fmtDate, fmtTime } from '@/lib/time';
import Flash from '@/components/Flash';

export const metadata = { title: 'Clients' };

export default async function Trainer({ searchParams }) {
  const me = await requireUser(['trainer', 'admin']);
  const sp = await searchParams;
  const db = getDb();
  const all = me.role === 'admin' && sp.all === '1';
  const clients = db.prepare(`SELECT u.id, u.name, u.email, u.goals, t.name AS trainer,
      (SELECT MAX(date) FROM workouts w WHERE w.user_id = u.id) AS last_workout,
      (SELECT COUNT(*) FROM bookings b JOIN class_sessions cs ON cs.id = b.session_id WHERE b.user_id = u.id AND b.status = 'attended' AND cs.starts_at >= ?) AS attended_30
    FROM users u LEFT JOIN users t ON t.id = u.trainer_id WHERE u.role = 'member' ${all ? '' : 'AND u.trainer_id = ?'} ORDER BY u.name`)
    .all(...(all ? [addDays(today(), -30)] : [addDays(today(), -30), me.id]));
  const sessions = db.prepare(`SELECT cs.*, ct.name, (SELECT COUNT(*) FROM bookings b WHERE b.session_id = cs.id AND b.status IN ('booked','attended','no_show')) AS booked
    FROM class_sessions cs JOIN class_types ct ON ct.id = cs.class_type_id WHERE cs.trainer_id = ? AND cs.starts_at >= ? AND cs.starts_at < ? AND cs.cancelled = 0 ORDER BY cs.starts_at`)
    .all(me.id, addDays(today(), -2) + ' 00:00', addDays(today(), 7) + ' 23:59');
  const now = nowLocal();
  return (
    <>
      <Flash sp={sp} />
      <div className="space-between"><h1>{all ? 'All members' : 'My clients'}</h1>
        {me.role === 'admin' && <div className="tabs" style={{ margin: 0 }}><Link className={!all ? 'active' : ''} href="/trainer">My clients</Link><Link className={all ? 'active' : ''} href="/trainer?all=1">All members</Link></div>}</div>
      <div className="grid g-2-1">
        <div className="card">
          <div className="table-wrap"><table className="t"><thead><tr><th>Client</th><th>Goals</th><th>Last workout</th><th>Classes (30d)</th></tr></thead><tbody>
            {clients.map((c) => <tr key={c.id}><td><Link href={`/trainer/clients/${c.id}`}><strong>{c.name}</strong></Link><div className="small muted">{c.email}{all && c.trainer ? ` · ${c.trainer.replace(/ \(Demo.*\)/, '')}` : ''}</div></td>
              <td className="small">{c.goals || <span className="muted">-</span>}</td><td className="small">{c.last_workout ? fmtDate(c.last_workout) : '-'}</td><td>{c.attended_30}</td></tr>)}
            {clients.length === 0 && <tr><td colSpan={4} className="muted">No clients assigned yet. An admin can assign members to you.</td></tr>}
          </tbody></table></div>
        </div>
        <div className="card"><h2>My classes (this week)</h2>
          {sessions.length === 0 && <p className="muted small">No classes.</p>}
          {sessions.map((s) => <div className="session" key={s.id} style={s.starts_at < now ? { opacity: 0.6 } : undefined}>
            <div className="info"><div className="name">{s.name}</div><div className="small muted">{fmtDate(s.starts_at)} {fmtTime(s.starts_at.slice(11))} · {s.booked}/{s.capacity}</div></div>
            <Link className="btn btn-ghost btn-sm" href={`/staff/sessions/${s.id}`}>Roster</Link></div>)}
        </div>
      </div>
    </>
  );
}
