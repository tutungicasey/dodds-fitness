import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser, canAccessClient } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { entitlements } from '@/lib/membership';
import { fmtDate } from '@/lib/time';
import Flash from '@/components/Flash';
import Csrf from '@/components/Csrf';
import { diaryData, Progress, WorkoutList, FoodList, MeasurementTable, NoteList } from '@/components/DiaryView';
import { addTrainerNoteAction, addProgramAction } from '@/app/actions/admin';

export const metadata = { title: 'Client' };

export default async function Client({ params, searchParams }) {
  const me = await requireUser(['trainer', 'admin']);
  const { id } = await params;
  const sp = await searchParams;
  const db = getDb();
  const c = db.prepare("SELECT u.*, t.name AS trainer FROM users u LEFT JOIN users t ON t.id = u.trainer_id WHERE u.id = ? AND u.role = 'member'").get(Number(id));
  if (!c) notFound();
  if (!canAccessClient(me, c)) redirect('/trainer?error=' + encodeURIComponent('That member is not one of your clients.'));
  const back = `/trainer/clients/${c.id}`;
  const data = diaryData(c.id);
  const ent = entitlements(c.id);
  const tnotes = db.prepare('SELECT t.*, u.name AS author FROM trainer_notes t LEFT JOIN users u ON u.id = t.trainer_id WHERE client_id = ? ORDER BY created_at DESC').all(c.id);
  const programs = db.prepare('SELECT * FROM programs WHERE client_id = ? ORDER BY created_at DESC').all(c.id);
  const H = () => <><Csrf /><input type="hidden" name="back" value={back} /><input type="hidden" name="client_id" value={c.id} /></>;
  return (
    <>
      <Flash sp={sp} />
      <p className="small"><Link href="/trainer">← Clients</Link></p>
      <h1>{c.name}</h1>
      <div className="grid g3">
        <div className="card"><h2>Profile</h2>
          <dl className="kv"><dt>Email</dt><dd>{c.email}</dd><dt>Mobile</dt><dd>{c.phone || '-'}</dd><dt>DOB</dt><dd>{c.dob || '-'}</dd><dt>Emergency</dt><dd>{c.emergency_contact || '-'}</dd>
            <dt>Goals</dt><dd>{c.goals || '-'}</dd><dt>Injuries</dt><dd>{c.injuries || '-'}</dd><dt>Trainer</dt><dd>{c.trainer?.replace(/ \(Demo.*\)/, '') || '-'}</dd>
            <dt>Plan</dt><dd>{ent.unlimited ? ent.unlimited.name : ent.credits ? `${ent.credits} credits` : 'None'}</dd></dl>
        </div>
        <div className="card"><h2>Trainer notes</h2>
          <form action={addTrainerNoteAction}><H />
            <div className="field"><textarea name="body" rows={3} required maxLength={2000} placeholder="Session notes, cues, follow-ups..." /></div>
            <div className="field"><label style={{ fontWeight: 400 }}><input type="checkbox" name="shared" /> Share this note with the client</label></div>
            <button className="btn btn-sm">Add note</button>
          </form>
          <ul className="list-plain" style={{ marginTop: 10 }}>{tnotes.map((n) => <li key={n.id} className="small">{n.body}<div className="muted">{n.author?.replace(/ \(Demo.*\)/, '')} · {fmtDate(n.created_at)} · {n.shared_with_client ? 'shared' : 'private'}</div></li>)}</ul>
        </div>
        <div className="card"><h2>Programs</h2>
          <form action={addProgramAction}><H />
            <div className="field"><input name="title" placeholder="Program title" required maxLength={100} /></div>
            <div className="field"><textarea name="details" rows={3} required maxLength={4000} placeholder={'Day A: ...\nDay B: ...'} /></div>
            <button className="btn btn-sm">Assign program</button>
          </form>
          {programs.map((p) => <div key={p.id} style={{ marginTop: 10 }}><strong>{p.title}</strong><pre className="prog small">{p.details}</pre></div>)}
        </div>
      </div>
      <h2 style={{ marginTop: 8 }}>Progress</h2>
      <Progress data={data} />
      <div className="grid g2">
        <div className="card"><h2>Workouts</h2><WorkoutList workouts={data.workouts.slice(0, 10)} readOnly /></div>
        <div className="card"><h2>Food (recent)</h2><FoodList food={data.food.slice(0, 20)} readOnly /></div>
        <div className="card"><h2>Measurements</h2><MeasurementTable measurements={data.measurements} readOnly /></div>
        <div className="card"><h2>Client&apos;s own notes</h2><NoteList notes={data.notes} readOnly /></div>
      </div>
    </>
  );
}
