import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { entitlements } from '@/lib/membership';
import { upcomingSessions } from '@/lib/booking';
import { nowLocal, addDays, today, fmtDate, fmtTime, fmtDateTime } from '@/lib/time';
import Flash from '@/components/Flash';
import SessionActions from '@/components/SessionActions';
import { diaryData, VolumeChart } from '@/components/DiaryView';

export const metadata = { title: 'Home' };

export default async function Dashboard({ searchParams }) {
  const me = await requireUser();
  const sp = await searchParams;
  const db = getDb();
  const ent = entitlements(me.id);
  const now = nowLocal();
  const mine = db.prepare(`SELECT cs.*, ct.name, b.status AS my_status, u.name AS trainer_name,
      (SELECT COUNT(*) FROM bookings x WHERE x.session_id = cs.id AND x.status IN ('booked','attended','no_show')) AS booked
    FROM bookings b JOIN class_sessions cs ON cs.id = b.session_id JOIN class_types ct ON ct.id = cs.class_type_id LEFT JOIN users u ON u.id = cs.trainer_id
    WHERE b.user_id = ? AND b.status IN ('booked','waitlist') AND cs.starts_at >= ? AND cs.cancelled = 0 ORDER BY cs.starts_at LIMIT 5`).all(me.id, now);
  const next = upcomingSessions(now, addDays(today(), 2) + ' 23:59', me.id).filter((s) => !s.my_status || s.my_status === 'cancelled').slice(0, 4);
  const monthStart = today().slice(0, 8) + '01';
  const workouts = db.prepare('SELECT COUNT(*) c FROM workouts WHERE user_id = ? AND date >= ?').get(me.id, monthStart).c;
  const attended = db.prepare("SELECT COUNT(*) c FROM bookings WHERE user_id = ? AND status = 'attended'").get(me.id).c;
  const attended30 = db.prepare("SELECT COUNT(*) c FROM bookings b JOIN class_sessions cs ON cs.id = b.session_id WHERE b.user_id = ? AND b.status = 'attended' AND cs.starts_at >= ?").get(me.id, addDays(today(), -30)).c;
  const data = diaryData(me.id);
  const programs = db.prepare('SELECT p.*, u.name AS trainer FROM programs p LEFT JOIN users u ON u.id = p.trainer_id WHERE client_id = ? ORDER BY created_at DESC').all(me.id);
  const tnotes = db.prepare('SELECT t.*, u.name AS trainer FROM trainer_notes t LEFT JOIN users u ON u.id = t.trainer_id WHERE client_id = ? AND shared_with_client = 1 ORDER BY created_at DESC LIMIT 3').all(me.id);
  const first = me.name.split(' ')[0];

  return (
    <>
      <Flash sp={sp} />
      <h1>G&apos;day, {first}</h1>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <div className="stat"><div className="label">Membership</div>
          <div className="value" style={{ fontSize: '1.1rem', marginTop: 6 }}>{ent.unlimited ? ent.unlimited.name : ent.credits ? `${ent.credits} class credits` : 'None active'}</div>
          <div className="sub">{ent.unlimited ? `Valid to ${fmtDate(ent.unlimited.ends_on, { day: 'numeric', month: 'short', year: 'numeric' })}` : <Link href="/membership">Buy a membership</Link>}</div></div>
        <div className="stat"><div className="label">Next class</div>
          <div className="value" style={{ fontSize: '1.1rem', marginTop: 6 }}>{mine[0] ? mine[0].name : '-'}</div>
          <div className="sub">{mine[0] ? fmtDateTime(mine[0].starts_at) : <Link href="/timetable">Book a class</Link>}</div></div>
        <div className="stat"><div className="label">Workouts this month</div><div className="value">{workouts}</div><div className="sub">{attended} classes attended all-time</div></div>
        <div className="stat"><div className="label">Classes (30 days)</div><div className="value">{attended30}</div><div className="sub"><Link href="/timetable">Book your next one</Link></div></div>
      </div>
      <div className="grid g-2-1">
        <div>
          <div className="card">
            <div className="space-between"><h2>Your upcoming bookings</h2><Link href="/bookings" className="small">All bookings</Link></div>
            {mine.length === 0 && <p className="muted">No upcoming bookings. <Link href="/timetable">Browse the timetable</Link>.</p>}
            {mine.map((s) => (
              <div className="session" key={s.id}>
                <div className="time">{fmtTime(s.starts_at.slice(11))}</div>
                <div className="info"><div className="name">{s.name}</div><div className="small muted">{fmtDate(s.starts_at)} · {s.trainer_name?.replace(/ \(Demo.*\)/, '')}</div></div>
                <SessionActions s={s} back="/dashboard" />
              </div>
            ))}
          </div>
          <div className="card">
            <div className="space-between"><h2>Coming up soon</h2><Link href="/timetable" className="small">Full timetable</Link></div>
            {next.length === 0 && <p className="muted">Nothing else in the next couple of days.</p>}
            {next.map((s) => (
              <div className="session" key={s.id}>
                <div className="time">{fmtTime(s.starts_at.slice(11))}</div>
                <div className="info"><div className="name">{s.name}</div><div className="small muted">{fmtDate(s.starts_at)} · {s.booked}/{s.capacity} booked</div></div>
                <SessionActions s={s} back="/dashboard" />
              </div>
            ))}
          </div>
          <div className="card"><div className="space-between"><h2>Weekly training volume (kg lifted)</h2><Link href="/diary" className="small">Diary</Link></div>
            <VolumeChart workouts={data.workouts} /></div>
        </div>
        <div>
          <div className="card"><h2>Your programs</h2>
            {programs.length === 0 && <p className="muted small">Your trainer hasn&apos;t assigned a program yet.</p>}
            {programs.map((p) => <div key={p.id} style={{ marginBottom: 12 }}><strong>{p.title}</strong><div className="small muted">from {p.trainer?.replace(/ \(Demo.*\)/, '')}</div><pre className="prog small">{p.details}</pre></div>)}
          </div>
          <div className="card"><h2>Notes from your trainer</h2>
            {tnotes.length === 0 && <p className="muted small">No notes yet.</p>}
            <ul className="list-plain">{tnotes.map((n) => <li key={n.id} className="small">{n.body}<div className="muted">{n.trainer?.replace(/ \(Demo.*\)/, '')} · {fmtDate(n.created_at)}</div></li>)}</ul>
          </div>
          <div className="card"><h2>Quick add</h2><div className="actions">
            <Link className="btn btn-sm" href="/diary?tab=workouts">+ Workout</Link><Link className="btn btn-sm" href="/diary?tab=food">+ Food</Link>
            <Link className="btn btn-sm" href="/diary?tab=measurements">+ Measurement</Link><Link className="btn btn-sm" href="/diary?tab=notes">+ Note</Link></div></div>
        </div>
      </div>
    </>
  );
}
