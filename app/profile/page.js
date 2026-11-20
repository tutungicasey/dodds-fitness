import { requireUser } from '@/lib/auth';
import Flash from '@/components/Flash';
import Csrf from '@/components/Csrf';
import { updateProfileAction, deleteAccountAction } from '@/app/actions/profile';
import { changePasswordAction } from '@/app/actions/auth';
import { getDb } from '@/lib/db';

export const metadata = { title: 'Profile' };

export default async function Profile({ searchParams }) {
  const me = await requireUser();
  const sp = await searchParams;
  const trainer = me.trainer_id ? getDb().prepare('SELECT name FROM users WHERE id = ?').get(me.trainer_id) : null;
  const H = () => <><Csrf /><input type="hidden" name="back" value="/profile" /></>;
  return (
    <>
      <Flash sp={sp} />
      <h1>My profile</h1>
      <div className="grid g-2-1">
        <form action={updateProfileAction} className="card">
          <h2>Details</h2><H />
          <div className="row">
            <div className="field"><label>Full name</label><input name="name" defaultValue={me.name} required maxLength={80} /></div>
            <div className="field"><label>Email</label><input value={me.email} disabled /></div>
          </div>
          <div className="row">
            <div className="field"><label>Mobile</label><input name="phone" defaultValue={me.phone || ''} maxLength={30} inputMode="tel" /></div>
            <div className="field"><label>Date of birth</label><input name="dob" type="date" defaultValue={me.dob || ''} /></div>
          </div>
          <div className="field"><label>Emergency contact</label><input name="emergency" defaultValue={me.emergency_contact || ''} maxLength={200} placeholder="Name and phone" /></div>
          <div className="field"><label>Goals</label><textarea name="goals" rows={2} defaultValue={me.goals || ''} maxLength={500} /></div>
          <div className="field"><label>Injuries / health notes for your trainer</label><textarea name="injuries" rows={2} defaultValue={me.injuries || ''} maxLength={500} /></div>
          <button className="btn">Save profile</button>
        </form>
        <div>
          <div className="card"><h2>Account</h2>
            <dl className="kv"><dt>Role</dt><dd>{me.role}</dd><dt>Trainer</dt><dd>{trainer ? trainer.name.replace(/ \(Demo.*\)/, '') : 'Not assigned'}</dd><dt>Joined</dt><dd>{me.created_at.slice(0, 10)}</dd></dl>
          </div>
          <form action={changePasswordAction} className="card">
            <h2>Change password</h2><H />
            <div className="field"><label>Current password</label><input name="current" type="password" autoComplete="current-password" required /></div>
            <div className="field"><label>New password</label><input name="new" type="password" autoComplete="new-password" minLength={10} required /></div>
            <button className="btn btn-ghost">Update password</button>
          </form>
          <div className="card"><h2>Your data</h2>
            <p className="small muted">Download everything we hold about you as a JSON file.</p>
            <a className="btn btn-ghost" href="/api/me/export">Export my data</a>
          </div>
          <form action={deleteAccountAction} className="card" style={{ borderColor: '#fecaca' }}>
            <h2>Delete account</h2><H />
            <p className="small muted">Permanently deletes your profile, bookings and diary. This cannot be undone.</p>
            <div className="field"><label>Type DELETE to confirm</label><input name="confirm" required pattern="DELETE" /></div>
            <div className="field"><label>Password</label><input name="password" type="password" autoComplete="current-password" required /></div>
            <button className="btn btn-danger">Delete my account</button>
          </form>
        </div>
      </div>
    </>
  );
}
