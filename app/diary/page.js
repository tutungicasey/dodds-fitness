import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { today } from '@/lib/time';
import Flash from '@/components/Flash';
import Csrf from '@/components/Csrf';
import { diaryData, Progress, WorkoutList, FoodList, MeasurementTable, NoteList } from '@/components/DiaryView';
import { addWorkoutAction, addFoodAction, addMeasurementAction, addNoteAction } from '@/app/actions/diary';

export const metadata = { title: 'Diary' };
const TABS = [['progress', 'Progress'], ['workouts', 'Workouts'], ['food', 'Food'], ['measurements', 'Body'], ['notes', 'Notes']];

export default async function Diary({ searchParams }) {
  const me = await requireUser();
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab : 'progress';
  const back = `/diary?tab=${tab}`;
  const data = diaryData(me.id);
  const t = today();
  const Hidden = () => <><Csrf /><input type="hidden" name="back" value={back} /></>;

  return (
    <>
      <Flash sp={sp} />
      <h1>My diary</h1>
      <div className="tabs">{TABS.map(([k, l]) => <Link key={k} className={tab === k ? 'active' : ''} href={`/diary?tab=${k}`}>{l}</Link>)}</div>

      {tab === 'progress' && <Progress data={data} />}

      {tab === 'workouts' && (
        <div className="grid g2">
          <form action={addWorkoutAction} className="card">
            <h2>Log a workout</h2><Hidden />
            <div className="row"><div className="field"><label>Date</label><input type="date" name="date" defaultValue={t} max={t} required /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}><label>Title</label><input name="title" placeholder="e.g. Leg day" required maxLength={100} /></div></div>
            {Array.from({ length: 5 }, (_, i) => (
              <div className="row" key={i} style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
                <div className="field"><label>{i === 0 ? 'Exercise' : <span className="muted">Exercise {i + 1}</span>}</label><input name={`exercise_${i}`} placeholder={['Back squat', 'Bench press', 'Row', '', ''][i]} maxLength={80} required={i === 0} /></div>
                <div className="field"><label>Sets</label><input name={`sets_${i}`} type="number" min="1" max="50" inputMode="numeric" /></div>
                <div className="field"><label>Reps</label><input name={`reps_${i}`} type="number" min="1" max="500" inputMode="numeric" /></div>
                <div className="field"><label>kg</label><input name={`weight_${i}`} type="number" step="0.25" min="0" max="1000" inputMode="decimal" /></div>
              </div>
            ))}
            <div className="field"><label>Notes</label><textarea name="notes" rows={2} maxLength={1000} /></div>
            <button className="btn">Save workout</button>
          </form>
          <div className="card"><h2>Recent workouts</h2><WorkoutList workouts={data.workouts} back={back} /></div>
        </div>
      )}

      {tab === 'food' && (
        <div className="grid g2">
          <form action={addFoodAction} className="card">
            <h2>Log food</h2><Hidden />
            <div className="row"><div className="field"><label>Date</label><input type="date" name="date" defaultValue={t} max={t} required /></div>
              <div className="field"><label>Meal</label><select name="meal">{['Breakfast', 'Lunch', 'Dinner', 'Snack'].map((m) => <option key={m}>{m}</option>)}</select></div></div>
            <div className="field"><label>What did you eat?</label><input name="description" required maxLength={200} placeholder="e.g. Chicken salad wrap" /></div>
            <div className="row">
              <div className="field"><label>Calories</label><input name="calories" type="number" min="0" max="10000" inputMode="numeric" /></div>
              <div className="field"><label>Protein g</label><input name="protein" type="number" step="0.1" min="0" inputMode="decimal" /></div>
              <div className="field"><label>Carbs g</label><input name="carbs" type="number" step="0.1" min="0" inputMode="decimal" /></div>
              <div className="field"><label>Fat g</label><input name="fat" type="number" step="0.1" min="0" inputMode="decimal" /></div>
            </div>
            <button className="btn">Save food</button>
          </form>
          <div className="card"><h2>Food log</h2><FoodList food={data.food} back={back} /></div>
        </div>
      )}

      {tab === 'measurements' && (
        <div className="grid g2">
          <form action={addMeasurementAction} className="card">
            <h2>Log body measurements</h2><Hidden />
            <div className="field"><label>Date</label><input type="date" name="date" defaultValue={t} max={t} required /></div>
            <div className="row">
              <div className="field"><label>Body fat %</label><input name="bf" type="number" step="0.1" inputMode="decimal" /></div>
              <div className="field"><label>Waist cm</label><input name="waist" type="number" step="0.1" inputMode="decimal" /></div>
              <div className="field"><label>Chest cm</label><input name="chest" type="number" step="0.1" inputMode="decimal" /></div>
              <div className="field"><label>Hips cm</label><input name="hips" type="number" step="0.1" inputMode="decimal" /></div>
            </div>
            <button className="btn">Save measurements</button>
          </form>
          <div className="card"><h2>History</h2><MeasurementTable measurements={data.measurements} back={back} /></div>
        </div>
      )}

      {tab === 'notes' && (
        <div className="grid g2">
          <form action={addNoteAction} className="card">
            <h2>Add a note</h2><Hidden />
            <div className="field"><label>Date</label><input type="date" name="date" defaultValue={t} max={t} required /></div>
            <div className="field"><label>Note</label><textarea name="body" rows={4} required maxLength={2000} placeholder="How did you feel? Sleep, energy, soreness..." /></div>
            <button className="btn">Save note</button>
          </form>
          <div className="card"><h2>Your notes</h2><NoteList notes={data.notes} back={back} /></div>
        </div>
      )}
    </>
  );
}
