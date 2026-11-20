import { getDb } from '@/lib/db';
import { fmtDate, today, addDays, mondayOf } from '@/lib/time';
import { LineChart, BarChart } from './Charts';
import Csrf from './Csrf';
import { deleteEntryAction } from '@/app/actions/diary';

const short = (d) => fmtDate(d, { day: 'numeric', month: 'short' });

function Del({ kind, id, back }) {
  return (
    <form action={deleteEntryAction} className="inline">
      <Csrf /><input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} /><input type="hidden" name="back" value={back} />
      <button className="btn btn-ghost btn-sm" title="Delete">Delete</button>
    </form>
  );
}

export function diaryData(userId) {
  const db = getDb();
  const workouts = db.prepare('SELECT * FROM workouts WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 60').all(userId);
  const sets = db.prepare(`SELECT ws.* FROM workout_sets ws JOIN workouts w ON w.id = ws.workout_id WHERE w.user_id = ?`).all(userId);
  for (const w of workouts) w.sets = sets.filter((s) => s.workout_id === w.id);
  const food = db.prepare('SELECT * FROM food_entries WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 100').all(userId);
  const measurements = db.prepare('SELECT * FROM measurements WHERE user_id = ? ORDER BY date').all(userId);
  const notes = db.prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 50').all(userId);
  return { workouts, food, measurements, notes };
}

/** Weekly training volume (sets x reps x kg lifted) over the last 8 weeks. */
export function VolumeChart({ workouts }) {
  const wk0 = mondayOf(addDays(today(), -49));
  const data = Array.from({ length: 8 }, (_, i) => addDays(wk0, i * 7)).map((wk) => ({
    label: short(wk),
    value: Math.round(workouts.filter((w) => w.date >= wk && w.date < addDays(wk, 7)).reduce((s, w) => s + w.sets.reduce((a, x) => a + x.sets * x.reps * (x.weight_kg || 0), 0), 0)),
  }));
  return <BarChart data={data} format={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}t` : v)} />;
}

export function Progress({ data }) {
  const { workouts, food, measurements } = data;
  const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6));
  const cals = days.map((d) => ({ label: short(d), value: food.filter((f) => f.date === d).reduce((s, f) => s + (f.calories || 0), 0) }));
  // Best lift per exercise (top 4 by frequency)
  const byEx = {};
  for (const w of [...workouts].reverse()) for (const s of w.sets) if (s.weight_kg) (byEx[s.exercise] ||= []).push({ date: w.date, kg: s.weight_kg });
  const topEx = Object.entries(byEx).sort((a, b) => b[1].length - a[1].length).slice(0, 2);
  return (
    <div className="grid g2">
      <div className="card"><h2>Body fat (%)</h2><LineChart points={measurements.filter((m) => m.body_fat_pct).map((m) => ({ x: short(m.date), y: m.body_fat_pct }))} unit="%" /></div>
      <div className="card"><h2>Waist (cm)</h2><LineChart color="#6366f1" points={measurements.filter((m) => m.waist_cm).map((m) => ({ x: short(m.date), y: m.waist_cm }))} unit=" cm" /></div>
      <div className="card"><h2>Weekly training volume (kg lifted)</h2><VolumeChart workouts={workouts} /></div>
      <div className="card"><h2>Calories - last 7 days</h2><BarChart data={cals} color="#f59e0b" /></div>
      {topEx.map(([ex, pts]) => (
        <div className="card" key={ex}><h2>{ex} - load lifted (kg)</h2><LineChart color="#0ea5e9" points={pts.map((p) => ({ x: short(p.date), y: p.kg }))} unit=" kg" /></div>
      ))}
    </div>
  );
}

export function WorkoutList({ workouts, back, readOnly }) {
  if (!workouts.length) return <p className="muted">No workouts logged yet.</p>;
  return workouts.map((w) => (
    <div key={w.id} className="session" style={{ alignItems: 'flex-start' }}>
      <div className="time small">{short(w.date)}</div>
      <div className="info"><div className="name">{w.title}</div>
        <div className="small">{w.sets.map((s) => <div key={s.id}>{s.exercise}: {s.sets}×{s.reps}{s.weight_kg != null ? ` @ ${s.weight_kg} kg` : ''}</div>)}</div>
        {w.notes && <div className="small muted">“{w.notes}”</div>}</div>
      {!readOnly && <Del kind="workout" id={w.id} back={back} />}
    </div>
  ));
}

export function FoodList({ food, back, readOnly }) {
  if (!food.length) return <p className="muted">No food entries yet.</p>;
  const dates = [...new Set(food.map((f) => f.date))];
  return dates.map((d) => {
    const items = food.filter((f) => f.date === d);
    const t = items.reduce((a, f) => ({ c: a.c + (f.calories || 0), p: a.p + (f.protein_g || 0), cb: a.cb + (f.carbs_g || 0), fa: a.fa + (f.fat_g || 0) }), { c: 0, p: 0, cb: 0, fa: 0 });
    return (
      <div key={d} style={{ marginBottom: 14 }}>
        <div className="space-between"><strong>{fmtDate(d, { weekday: 'long', day: 'numeric', month: 'short' })}</strong>
          <span className="small muted">{t.c} kcal · P {Math.round(t.p)}g · C {Math.round(t.cb)}g · F {Math.round(t.fa)}g</span></div>
        <div className="table-wrap"><table className="t"><tbody>
          {items.map((f) => <tr key={f.id}><td style={{ width: 90 }} className="muted">{f.meal}</td><td>{f.description}</td><td className="small muted">{f.calories ?? '-'} kcal</td>
            {!readOnly && <td style={{ width: 70 }}><Del kind="food" id={f.id} back={back} /></td>}</tr>)}
        </tbody></table></div>
      </div>
    );
  });
}

export function MeasurementTable({ measurements, back, readOnly }) {
  if (!measurements.length) return <p className="muted">No measurements yet.</p>;
  return (
    <div className="table-wrap"><table className="t"><thead><tr><th>Date</th><th>Body fat %</th><th>Waist</th><th>Chest</th><th>Hips</th>{!readOnly && <th></th>}</tr></thead><tbody>
      {[...measurements].reverse().map((m) => <tr key={m.id}><td>{short(m.date)}</td><td>{m.body_fat_pct ?? '-'}</td><td>{m.waist_cm ?? '-'}</td><td>{m.chest_cm ?? '-'}</td><td>{m.hips_cm ?? '-'}</td>
        {!readOnly && <td><Del kind="measurement" id={m.id} back={back} /></td>}</tr>)}
    </tbody></table></div>
  );
}

export function NoteList({ notes, back, readOnly }) {
  if (!notes.length) return <p className="muted">No notes yet.</p>;
  return <ul className="list-plain">{notes.map((n) => <li key={n.id} className="space-between"><div><div className="small muted">{short(n.date)}</div>{n.body}</div>{!readOnly && <Del kind="note" id={n.id} back={back} />}</li>)}</ul>;
}
