import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { aud } from '@/lib/money';
import { today, addDays, nowLocal, mondayOf, fmtDate, fmtTime, DAYS } from '@/lib/time';
import Flash from '@/components/Flash';
import AdminNav from '@/components/AdminNav';
import { BarChart, Heatmap } from '@/components/Charts';

export const metadata = { title: 'Admin dashboard' };
const COLORS = { HIIT: '#ef4444', Spin: '#0ea5e9', Yoga: '#a855f7', Strength: '#14b8a6' };

export default async function Admin({ searchParams }) {
  await requireUser(['admin']);
  const sp = await searchParams;
  const db = getDb();
  const now = nowLocal(), t = today();
  const from = addDays(t, -42) + ' 00:00';
  const one = (sql, ...a) => db.prepare(sql).get(...a);
  const members = one("SELECT COUNT(*) c FROM users WHERE role = 'member'").c;
  const newMembers = one("SELECT COUNT(*) c FROM users WHERE role = 'member' AND created_at >= ?", addDays(t, -30)).c;
  const active = one(`SELECT COUNT(DISTINCT m.user_id) c FROM memberships m WHERE m.starts_on <= ? AND m.ends_on >= ? AND (m.credits_remaining IS NULL OR m.credits_remaining > 0)`, t, t).c;
  const rev30 = one("SELECT COALESCE(SUM(amount_cents),0) s FROM payments WHERE status = 'paid' AND paid_at >= ?", addDays(t, -30)).s;
  const revPrev = one("SELECT COALESCE(SUM(amount_cents),0) s FROM payments WHERE status = 'paid' AND paid_at >= ? AND paid_at < ?", addDays(t, -60), addDays(t, -30)).s;
  const next7 = one("SELECT COUNT(*) c FROM bookings b JOIN class_sessions cs ON cs.id = b.session_id WHERE b.status = 'booked' AND cs.starts_at >= ? AND cs.starts_at < ?", now, addDays(t, 7) + ' 23:59').c;

  // Per-session stats for past sessions in window
  const past = db.prepare(`SELECT cs.id, cs.starts_at, cs.capacity, ct.name,
      SUM(CASE WHEN b.status IN ('booked','attended','no_show') THEN 1 ELSE 0 END) AS confirmed,
      SUM(CASE WHEN b.status = 'attended' THEN 1 ELSE 0 END) AS attended,
      SUM(CASE WHEN b.status = 'no_show' THEN 1 ELSE 0 END) AS no_show
    FROM class_sessions cs JOIN class_types ct ON ct.id = cs.class_type_id LEFT JOIN bookings b ON b.session_id = cs.id
    WHERE cs.starts_at >= ? AND cs.starts_at < ? AND cs.cancelled = 0 GROUP BY cs.id`).all(from, now);
  const byName = {};
  for (const s of past) {
    const g = (byName[s.name] ||= { name: s.name, sessions: 0, bookings: 0, cap: 0, attended: 0, marked: 0 });
    g.sessions++; g.bookings += s.confirmed; g.cap += s.capacity; g.attended += s.attended; g.marked += s.attended + s.no_show;
  }
  const classes = Object.values(byName).sort((a, b) => b.bookings - a.bookings);
  const avgFill = past.length ? Math.round((100 * past.reduce((a, s) => a + s.confirmed / s.capacity, 0)) / past.length) : 0;
  const waitlisted = one("SELECT COUNT(*) c FROM bookings b JOIN class_sessions cs ON cs.id = b.session_id WHERE b.status = 'waitlist' AND cs.starts_at >= ?", now).c;

  // Busiest times heatmap: avg confirmed bookings per session by weekday x start time
  const times = [...new Set(past.map((s) => s.starts_at.slice(11)))].sort();
  const order = [1, 2, 3, 4, 5, 6, 0];
  const cells = order.map((d) => times.map((tm) => {
    const ss = past.filter((s) => new Date(s.starts_at.slice(0, 10) + 'T00:00:00Z').getUTCDay() === d && s.starts_at.slice(11) === tm);
    return ss.length ? Math.round(ss.reduce((a, s) => a + s.confirmed, 0) / ss.length) : 0;
  }));
  // Revenue by week (last 10 weeks)
  const w0 = mondayOf(addDays(t, -63));
  const revWeeks = Array.from({ length: 10 }, (_, i) => {
    const a = addDays(w0, i * 7), b = addDays(a, 7);
    return { label: fmtDate(a, { day: 'numeric', month: 'short' }), value: one("SELECT COALESCE(SUM(amount_cents),0) s FROM payments WHERE status='paid' AND paid_at >= ? AND paid_at < ?", a, b).s / 100 };
  });
  const upcoming = db.prepare(`SELECT cs.*, ct.name, (SELECT COUNT(*) FROM bookings b WHERE b.session_id = cs.id AND b.status = 'booked') AS booked,
      (SELECT COUNT(*) FROM bookings b WHERE b.session_id = cs.id AND b.status = 'waitlist') AS waitlist
    FROM class_sessions cs JOIN class_types ct ON ct.id = cs.class_type_id WHERE cs.starts_at >= ? AND cs.cancelled = 0 ORDER BY cs.starts_at LIMIT 8`).all(now);
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);

  return (
    <>
      <Flash sp={sp} />
      <h1>Admin dashboard</h1>
      <AdminNav active="/admin" />
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <div className="stat"><div className="label">Members</div><div className="value">{members}</div><div className="sub">{active} with active plan · +{newMembers} in 30 days</div></div>
        <div className="stat"><div className="label">Revenue (30 days)</div><div className="value">{aud(rev30)}</div><div className="sub">{revPrev ? `${rev30 >= revPrev ? '▲' : '▼'} ${Math.abs(pct(rev30 - revPrev, revPrev))}% vs prior 30 days` : '-'}</div></div>
        <div className="stat"><div className="label">Avg class fill (6 wks)</div><div className="value">{avgFill}%</div><div className="sub">{past.length} classes run</div></div>
        <div className="stat"><div className="label">Booked next 7 days</div><div className="value">{next7}</div><div className="sub">{waitlisted} on waitlists</div></div>
      </div>
      <div className="grid g2">
        <div className="card"><h2>Most popular classes - bookings (last 6 weeks)</h2>
          <BarChart data={classes.map((c) => ({ label: c.name, value: c.bookings, color: COLORS[c.name] }))} /></div>
        <div className="card"><h2>Fill rate &amp; attendance by class</h2>
          <BarChart max={100} format={(v) => `${v}%`} data={classes.map((c) => ({ label: c.name, value: pct(c.bookings, c.cap), sub: `${pct(c.attended, c.marked)}% attended`, color: COLORS[c.name] }))} /></div>
        <div className="card"><h2>Busiest times - avg bookings per class</h2>
          <Heatmap rows={order.map((d) => DAYS[d])} cols={times.map(fmtTime)} values={cells} />
          <p className="small muted">Darker = busier. Based on the last 6 weeks.</p></div>
        <div className="card"><h2>Revenue by week (AUD)</h2><BarChart data={revWeeks} color="#6366f1" format={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`)} /></div>
      </div>
      <div className="grid g2">
        <div className="card"><h2>Class league table</h2>
          <div className="table-wrap"><table className="t"><thead><tr><th>Class</th><th>Sessions</th><th>Bookings</th><th>Fill</th><th>Attendance</th></tr></thead><tbody>
            {classes.map((c) => <tr key={c.name}><td><strong>{c.name}</strong></td><td>{c.sessions}</td><td>{c.bookings}</td><td>{pct(c.bookings, c.cap)}%</td><td>{pct(c.attended, c.marked)}%</td></tr>)}
          </tbody></table></div></div>
        <div className="card"><div className="space-between"><h2>Next classes</h2><Link className="small" href="/admin/classes">Manage classes</Link></div>
          <div className="table-wrap"><table className="t"><thead><tr><th>When</th><th>Class</th><th>Booked</th><th></th></tr></thead><tbody>
            {upcoming.map((s) => <tr key={s.id}><td>{fmtDate(s.starts_at)} {fmtTime(s.starts_at.slice(11))}</td><td>{s.name}</td><td>{s.booked}/{s.capacity}{s.waitlist ? <span className="pill waitlist" style={{ marginLeft: 6 }}>+{s.waitlist} wait</span> : null}</td><td><Link href={`/staff/sessions/${s.id}`}>Roster</Link></td></tr>)}
          </tbody></table></div></div>
      </div>
    </>
  );
}
