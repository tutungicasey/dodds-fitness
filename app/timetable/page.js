import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { upcomingSessions } from '@/lib/booking';
import { entitlements } from '@/lib/membership';
import { today, addDays, mondayOf, fmtDate, fmtTime, nowLocal } from '@/lib/time';
import Flash from '@/components/Flash';
import SessionActions from '@/components/SessionActions';

export const metadata = { title: 'Class timetable' };

export default async function Timetable({ searchParams }) {
  const me = await requireUser();
  const sp = await searchParams;
  const view = sp.view === 'list' ? 'list' : 'calendar';
  const w = Math.max(-1, Math.min(2, parseInt(sp.w || '0', 10) || 0));
  const start = addDays(mondayOf(today()), w * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const sessions = upcomingSessions(`${start} 00:00`, `${addDays(start, 7)} 00:00`, me.id);
  const now = nowLocal();
  const ent = entitlements(me.id);
  const back = `/timetable?view=${view}&w=${w}`;
  const byDay = Object.fromEntries(days.map((d) => [d, sessions.filter((s) => s.starts_at.startsWith(d))]));

  return (
    <>
      <Flash sp={sp} />
      <div className="space-between">
        <h1>Class timetable</h1>
        <div className="tabs" style={{ margin: 0 }}>
          <Link className={view === 'calendar' ? 'active' : ''} href={`/timetable?view=calendar&w=${w}`}>Calendar</Link>
          <Link className={view === 'list' ? 'active' : ''} href={`/timetable?view=list&w=${w}`}>List</Link>
        </div>
      </div>
      {!ent.canBook && <div className="flash err">You need an active membership or class credits to book. <Link href="/membership">See options</Link></div>}
      <div className="space-between" style={{ marginBottom: 12 }}>
        <Link className="btn btn-ghost btn-sm" href={`/timetable?view=${view}&w=${w - 1}`} aria-disabled={w <= -1}>← Prev week</Link>
        <strong>Week of {fmtDate(start, { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
        <Link className="btn btn-ghost btn-sm" href={`/timetable?view=${view}&w=${w + 1}`}>Next week →</Link>
      </div>

      {view === 'calendar' ? (
        <div className="card">
          <div className="legend"><span><i style={{ background: '#14b8a6' }} />Available</span><span><i style={{ background: '#16a34a' }} />Booked</span><span><i style={{ background: '#d97706' }} />Waitlisted</span><span><i style={{ background: '#ef4444' }} />Full</span></div>
          <div className="cal-wrap"><div className="cal">
            {days.map((d) => (
              <div key={d} className={`cal-day ${d === today() ? 'today' : ''}`}>
                <h3>{fmtDate(d)}</h3>
                {byDay[d].length === 0 && <div className="small muted">No classes</div>}
                {byDay[d].map((s) => {
                  const past = s.starts_at <= now;
                  const cls = s.my_status === 'booked' || s.my_status === 'attended' ? 'mine' : s.my_status === 'waitlist' ? 'wl' : s.booked >= s.capacity ? 'full' : '';
                  return (
                    <div key={s.id} className={`cal-ev ${cls} ${past ? 'past' : ''}`}>
                      <strong>{fmtTime(s.starts_at.slice(11))} {s.name}</strong>
                      <div className="muted">{s.booked}/{s.capacity}{s.waitlist ? ` · ${s.waitlist} waiting` : ''}</div>
                      <div style={{ marginTop: 4 }}><SessionActions s={s} back={back} past={past} /></div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div></div>
        </div>
      ) : (
        days.map((d) => byDay[d].length > 0 && (
          <div className="card" key={d}>
            <h2>{fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
            {byDay[d].map((s) => {
              const past = s.starts_at <= now;
              const full = s.booked >= s.capacity;
              return (
                <div className="session" key={s.id} style={past ? { opacity: 0.55 } : undefined}>
                  <div className="time">{fmtTime(s.starts_at.slice(11))}</div>
                  <div className="info">
                    <div className="name">{s.name} {full && !past && <span className="pill full">Full</span>}</div>
                    <div className="small muted">{s.duration_min} min · {s.trainer_name?.replace(/ \(Demo.*\)/, '')} · {s.booked}/{s.capacity} booked{s.waitlist ? ` · ${s.waitlist} on waitlist` : ''}</div>
                    <div className="bar"><span style={{ width: `${Math.min(100, (s.booked / s.capacity) * 100)}%` }} /></div>
                  </div>
                  <SessionActions s={s} back={back} past={past} />
                </div>
              );
            })}
          </div>
        ))
      )}
    </>
  );
}
