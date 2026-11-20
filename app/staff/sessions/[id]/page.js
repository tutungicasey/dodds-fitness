import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { fmtDate, fmtTime } from '@/lib/time';
import Flash from '@/components/Flash';
import Csrf from '@/components/Csrf';
import { markAttendanceAction, cancelSessionAction } from '@/app/actions/admin';

export const metadata = { title: 'Class roster' };

export default async function Roster({ params, searchParams }) {
  const me = await requireUser(['trainer', 'admin']);
  const { id } = await params;
  const sp = await searchParams;
  const db = getDb();
  const s = db.prepare('SELECT cs.*, ct.name, u.name AS trainer FROM class_sessions cs JOIN class_types ct ON ct.id = cs.class_type_id LEFT JOIN users u ON u.id = cs.trainer_id WHERE cs.id = ?').get(Number(id));
  if (!s) notFound();
  if (me.role === 'trainer' && s.trainer_id !== me.id) redirect('/trainer?error=' + encodeURIComponent('Not your class.'));
  const rows = db.prepare('SELECT b.*, u.name, u.email FROM bookings b JOIN users u ON u.id = b.user_id WHERE b.session_id = ? ORDER BY CASE b.status WHEN \'waitlist\' THEN 2 WHEN \'cancelled\' THEN 3 ELSE 1 END, b.created_at').all(s.id);
  const back = `/staff/sessions/${s.id}`;
  const confirmed = rows.filter((r) => ['booked', 'attended', 'no_show'].includes(r.status)).length;
  return (
    <>
      <Flash sp={sp} />
      <p className="small"><Link href={me.role === 'admin' ? '/admin/classes' : '/trainer'}>← Back</Link></p>
      <div className="space-between"><h1>{s.name} · {fmtDate(s.starts_at)} {fmtTime(s.starts_at.slice(11))}</h1>
        {me.role === 'admin' && !s.cancelled && <form action={cancelSessionAction}><Csrf /><input type="hidden" name="session_id" value={s.id} /><input type="hidden" name="back" value={back} /><button className="btn btn-danger btn-sm">Cancel this class</button></form>}</div>
      <p className="muted">{s.trainer?.replace(/ \(Demo.*\)/, '')} · {confirmed}/{s.capacity} booked{s.cancelled ? ' · CANCELLED' : ''}</p>
      <div className="card"><div className="table-wrap"><table className="t"><thead><tr><th>Member</th><th>Status</th><th>Attendance</th></tr></thead><tbody>
        {rows.map((r) => <tr key={r.id}><td>{r.name}<div className="small muted">{r.email}</div></td><td><span className={`pill ${r.status}`}>{r.status.replace('_', ' ')}</span></td>
          <td>{['booked', 'attended', 'no_show'].includes(r.status) && <div className="actions">
            {['attended', 'no_show'].map((st) => <form key={st} action={markAttendanceAction}><Csrf /><input type="hidden" name="booking_id" value={r.id} /><input type="hidden" name="status" value={st} /><input type="hidden" name="back" value={back} />
              <button className={`btn btn-sm ${r.status === st ? '' : 'btn-ghost'}`}>{st === 'attended' ? 'Attended' : 'No-show'}</button></form>)}
          </div>}</td></tr>)}
        {rows.length === 0 && <tr><td colSpan={3} className="muted">No bookings.</td></tr>}
      </tbody></table></div></div>
    </>
  );
}
