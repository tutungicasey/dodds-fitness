import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { fmtDate, fmtTime } from '@/lib/time';
import AdminNav from '@/components/AdminNav';

export const metadata = { title: 'Bookings' };

export default async function AdminBookings({ searchParams }) {
  await requireUser(['admin']);
  const sp = await searchParams;
  const status = ['booked', 'waitlist', 'cancelled', 'attended', 'no_show'].includes(sp.status) ? sp.status : null;
  const rows = getDb().prepare(`SELECT b.*, u.name AS member, ct.name AS class, cs.starts_at, cs.id AS sid FROM bookings b
    JOIN users u ON u.id = b.user_id JOIN class_sessions cs ON cs.id = b.session_id JOIN class_types ct ON ct.id = cs.class_type_id
    ${status ? 'WHERE b.status = ?' : ''} ORDER BY b.updated_at DESC, b.id DESC LIMIT 200`).all(...(status ? [status] : []));
  return (
    <>
      <h1>Bookings</h1>
      <AdminNav active="/admin/bookings" />
      <div className="tabs">{[null, 'booked', 'waitlist', 'attended', 'no_show', 'cancelled'].map((s) => <Link key={s || 'all'} className={status === s ? 'active' : ''} href={s ? `/admin/bookings?status=${s}` : '/admin/bookings'}>{s ? s.replace('_', ' ') : 'All'}</Link>)}</div>
      <div className="card"><div className="table-wrap"><table className="t"><thead><tr><th>Class</th><th>Member</th><th>Status</th><th>Updated</th></tr></thead><tbody>
        {rows.map((r) => <tr key={r.id}><td><Link href={`/staff/sessions/${r.sid}`}>{r.class}</Link><div className="small muted">{fmtDate(r.starts_at)} {fmtTime(r.starts_at.slice(11))}</div></td><td>{r.member}</td><td><span className={`pill ${r.status}`}>{r.status.replace('_', ' ')}</span></td><td className="small muted">{r.updated_at.slice(0, 16)} UTC</td></tr>)}
      </tbody></table></div><p className="small muted">Showing latest 200.</p></div>
    </>
  );
}
