import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { aud } from '@/lib/money';
import { today, addDays, fmtDate } from '@/lib/time';
import AdminNav from '@/components/AdminNav';
import { BarChart } from '@/components/Charts';
import { stripeMode } from '@/lib/stripe';

export const metadata = { title: 'Revenue' };

export default async function Payments() {
  await requireUser(['admin']);
  const db = getDb();
  const t = today();
  const byPlan = db.prepare("SELECT p.name, COUNT(*) n, SUM(amount_cents) s FROM payments pay JOIN plans p ON p.id = pay.plan_id WHERE pay.status = 'paid' AND pay.paid_at >= ? GROUP BY p.id ORDER BY s DESC").all(addDays(t, -90));
  const total = byPlan.reduce((a, r) => a + r.s, 0);
  const rows = db.prepare("SELECT pay.*, p.name AS plan, u.name AS member FROM payments pay JOIN plans p ON p.id = pay.plan_id LEFT JOIN users u ON u.id = pay.user_id ORDER BY pay.created_at DESC LIMIT 100").all();
  return (
    <>
      <h1>Revenue</h1>
      <AdminNav active="/admin/payments" />
      <p className="muted small">Payment mode: <strong>{stripeMode() === 'demo' ? 'DEMO (simulated)' : `Stripe ${stripeMode()}`}</strong>. Seeded historical payments are demo data.</p>
      <div className="grid g2">
        <div className="card"><h2>Last 90 days: {aud(total)}</h2>
          <BarChart data={byPlan.map((r) => ({ label: r.name.replace(' Unlimited', ''), value: r.s / 100, sub: `${r.n} sales` }))} color="#6366f1" format={(v) => `$${Math.round(v).toLocaleString('en-AU')}`} /></div>
        <div className="card"><h2>By plan</h2><table className="t"><thead><tr><th>Plan</th><th>Sales</th><th>Revenue</th></tr></thead><tbody>
          {byPlan.map((r) => <tr key={r.name}><td>{r.name}</td><td>{r.n}</td><td>{aud(r.s)}</td></tr>)}</tbody></table></div>
      </div>
      <div className="card"><h2>Recent payments</h2><div className="table-wrap"><table className="t"><thead><tr><th>Date</th><th>Member</th><th>Plan</th><th>Amount</th><th>Provider</th><th>Status</th></tr></thead><tbody>
        {rows.map((r) => <tr key={r.id}><td>{fmtDate(r.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</td><td>{r.member || <span className="muted">[deleted member]</span>}</td><td>{r.plan}</td><td>{aud(r.amount_cents)}</td><td>{r.provider === 'demo' ? <span className="pill demo">demo</span> : 'Stripe'}</td><td><span className={`pill ${r.status}`}>{r.status}</span></td></tr>)}
      </tbody></table></div></div>
    </>
  );
}
