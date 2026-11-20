import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import AdminNav from '@/components/AdminNav';

export const metadata = { title: 'Audit log' };

export default async function Audit() {
  await requireUser(['admin']);
  const rows = getDb().prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 300').all();
  return (
    <>
      <h1>Audit log</h1>
      <AdminNav active="/admin/audit" />
      <div className="card"><p className="small muted">Append-only record of staff logins, admin/trainer actions and privacy events (exports, deletions). Times in UTC.</p>
        <div className="table-wrap"><table className="t"><thead><tr><th>When (UTC)</th><th>Who</th><th>Action</th><th>Target</th><th>Details</th><th>IP</th></tr></thead><tbody>
          {rows.map((r) => <tr key={r.id}><td className="small">{r.created_at}</td><td className="small">{r.actor_email}</td><td><code>{r.action}</code></td><td className="small">{r.target}</td><td className="small muted" style={{ maxWidth: 300, wordBreak: 'break-word' }}>{r.details}</td><td className="small muted">{r.ip}</td></tr>)}
          {rows.length === 0 && <tr><td colSpan={6} className="muted">No entries yet.</td></tr>}
        </tbody></table></div></div>
    </>
  );
}
