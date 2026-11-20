import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { nowLocal, fmtDate, fmtTime } from '@/lib/time';
import Flash from '@/components/Flash';
import SessionActions from '@/components/SessionActions';

export const metadata = { title: 'My bookings' };

export default async function Bookings({ searchParams }) {
  const me = await requireUser();
  const sp = await searchParams;
  const now = nowLocal();
  const rows = getDb().prepare(`SELECT cs.*, ct.name, b.status AS my_status, u.name AS trainer_name,
      (SELECT COUNT(*) FROM bookings x WHERE x.session_id = cs.id AND x.status IN ('booked','attended','no_show')) AS booked,
      (SELECT COUNT(*) FROM bookings x WHERE x.session_id = cs.id AND x.status = 'waitlist' AND (x.created_at < b.created_at OR (x.created_at = b.created_at AND x.id <= b.id))) AS wl_pos
    FROM bookings b JOIN class_sessions cs ON cs.id = b.session_id JOIN class_types ct ON ct.id = cs.class_type_id LEFT JOIN users u ON u.id = cs.trainer_id
    WHERE b.user_id = ? ORDER BY cs.starts_at DESC LIMIT 100`).all(me.id);
  const upcoming = rows.filter((r) => r.starts_at > now && ['booked', 'waitlist'].includes(r.my_status)).reverse();
  const past = rows.filter((r) => r.starts_at <= now || !['booked', 'waitlist'].includes(r.my_status));
  return (
    <>
      <Flash sp={sp} />
      <h1>My bookings</h1>
      <div className="card">
        <h2>Upcoming</h2>
        {upcoming.length === 0 && <p className="muted">No upcoming classes. <Link href="/timetable">Book one</Link>.</p>}
        {upcoming.map((s) => (
          <div className="session" key={s.id}>
            <div className="time">{fmtTime(s.starts_at.slice(11))}</div>
            <div className="info"><div className="name">{s.name}</div>
              <div className="small muted">{fmtDate(s.starts_at, { weekday: 'long', day: 'numeric', month: 'short' })} · {s.trainer_name?.replace(/ \(Demo.*\)/, '')}{s.my_status === 'waitlist' ? ` · waitlist position #${s.wl_pos}` : ''}</div></div>
            <SessionActions s={s} back="/bookings" />
          </div>
        ))}
      </div>
      <div className="card">
        <h2>History</h2>
        <div className="table-wrap"><table className="t"><thead><tr><th>Date</th><th>Class</th><th>Status</th></tr></thead><tbody>
          {past.map((s) => <tr key={s.id}><td>{fmtDate(s.starts_at)} {fmtTime(s.starts_at.slice(11))}</td><td>{s.name}{s.cancelled ? ' (class cancelled)' : ''}</td><td><span className={`pill ${s.my_status}`}>{s.my_status.replace('_', ' ')}</span></td></tr>)}
          {past.length === 0 && <tr><td colSpan={3} className="muted">No history yet.</td></tr>}
        </tbody></table></div>
      </div>
    </>
  );
}
