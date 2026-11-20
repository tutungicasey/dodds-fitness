import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { DAYS_LONG, fmtTime, nowLocal, today } from '@/lib/time';
import Flash from '@/components/Flash';
import Csrf from '@/components/Csrf';
import AdminNav from '@/components/AdminNav';
import { createClassAction, deactivateClassAction } from '@/app/actions/admin';

export const metadata = { title: 'Classes' };

export default async function Classes({ searchParams }) {
  await requireUser(['admin']);
  const sp = await searchParams;
  const db = getDb();
  const trainers = db.prepare("SELECT id, name FROM users WHERE role IN ('trainer','admin') ORDER BY name").all();
  const types = db.prepare(`SELECT ct.*, u.name AS trainer,
      (SELECT COUNT(*) FROM class_sessions cs WHERE cs.class_type_id = ct.id AND cs.starts_at >= ? AND cs.cancelled = 0) AS upcoming
    FROM class_types ct LEFT JOIN users u ON u.id = ct.trainer_id ORDER BY ct.active DESC, CASE ct.day_of_week WHEN 0 THEN 7 ELSE ct.day_of_week END, ct.start_time`).all(nowLocal());
  const H = () => <><Csrf /><input type="hidden" name="back" value="/admin/classes" /></>;
  return (
    <>
      <Flash sp={sp} />
      <h1>Classes &amp; timetable</h1>
      <AdminNav active="/admin/classes" />
      <div className="grid g-2-1">
        <div className="card"><h2>Weekly timetable</h2>
          <div className="table-wrap"><table className="t"><thead><tr><th>Class</th><th>When</th><th>Trainer</th><th>Capacity</th><th>Upcoming</th><th></th></tr></thead><tbody>
            {types.map((c) => (
              <tr key={c.id} style={c.active ? undefined : { opacity: 0.5 }}>
                <td><strong>{c.name}</strong><div className="small muted">{c.description}</div></td>
                <td>{c.recurring ? `Every ${DAYS_LONG[c.day_of_week]}` : `One-off ${c.first_date}`}<div className="small muted">{fmtTime(c.start_time)} · {c.duration_min} min</div></td>
                <td className="small">{c.trainer?.replace(/ \(Demo.*\)/, '')}</td><td>{c.capacity}</td><td>{c.upcoming}</td>
                <td>{c.active ? <form action={deactivateClassAction}><H /><input type="hidden" name="class_type_id" value={c.id} /><button className="btn btn-ghost btn-sm">Deactivate</button></form> : <span className="pill">inactive</span>}</td>
              </tr>
            ))}
          </tbody></table></div>
          <p className="small muted">Recurring classes are automatically scheduled 3 weeks ahead. Open a session roster from the <Link href="/admin">dashboard</Link> or <Link href="/timetable">timetable</Link> to mark attendance or cancel a single class.</p>
        </div>
        <form action={createClassAction} className="card">
          <h2>Create a class</h2><H />
          <div className="field"><label>Name</label><input name="name" required maxLength={60} placeholder="e.g. Boxing" /></div>
          <div className="field"><label>Description</label><input name="description" maxLength={300} /></div>
          <div className="field"><label>Trainer</label><select name="trainer_id" required>{trainers.map((t) => <option key={t.id} value={t.id}>{t.name.replace(/ \(Demo.*\)/, '')}</option>)}</select></div>
          <div className="field"><label><input type="checkbox" name="recurring" defaultChecked /> Repeats weekly</label></div>
          <div className="row">
            <div className="field"><label>Day (weekly)</label><select name="day_of_week" defaultValue="1">{[1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={d}>{DAYS_LONG[d]}</option>)}</select></div>
            <div className="field"><label>or date (one-off)</label><input type="date" name="first_date" min={today()} /></div>
          </div>
          <div className="row">
            <div className="field"><label>Start</label><input type="time" name="start_time" required defaultValue="18:00" /></div>
            <div className="field"><label>Minutes</label><input type="number" name="duration_min" min="10" max="240" defaultValue="45" required /></div>
            <div className="field"><label>Capacity</label><input type="number" name="capacity" min="1" max="200" defaultValue="16" required /></div>
          </div>
          <button className="btn btn-block">Create class</button>
        </form>
      </div>
    </>
  );
}
