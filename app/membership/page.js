import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { entitlements } from '@/lib/membership';
import { stripeMode } from '@/lib/stripe';
import { aud } from '@/lib/money';
import { fmtDate } from '@/lib/time';
import Flash from '@/components/Flash';
import Csrf from '@/components/Csrf';
import { checkoutAction } from '@/app/actions/payments';

export const metadata = { title: 'Membership' };

export default async function Membership({ searchParams }) {
  const me = await requireUser();
  const sp = await searchParams;
  const db = getDb();
  const plans = db.prepare('SELECT * FROM plans WHERE active = 1 ORDER BY kind DESC, price_cents').all();
  const ent = entitlements(me.id);
  const mode = stripeMode();
  const history = db.prepare('SELECT pay.*, p.name FROM payments pay JOIN plans p ON p.id = pay.plan_id WHERE pay.user_id = ? ORDER BY pay.created_at DESC LIMIT 20').all(me.id);
  const d = (x) => fmtDate(x, { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <>
      <Flash sp={sp} />
      <h1>Membership &amp; class packs</h1>
      <div className="card">
        <h2>Your plan</h2>
        {ent.unlimited && <p><strong>{ent.unlimited.name}</strong> - active until {d(ent.unlimited.ends_on)}</p>}
        {ent.packs.map((p) => <p key={p.id}><strong>{p.name}</strong> - {p.credits_remaining} credit{p.credits_remaining === 1 ? '' : 's'} left, expires {d(p.ends_on)}</p>)}
        {!ent.canBook && <p className="muted">No active membership or credits.</p>}
      </div>
      <div className={`flash ${mode === 'demo' ? 'err' : 'ok'}`} style={mode === 'demo' ? { background: '#fffbeb', color: '#92400e', borderColor: '#fde68a' } : undefined}>
        {mode === 'demo' ? 'DEMO MODE: no payment provider is configured. Checkout uses a simulated payment - no card is requested and no money is charged.'
          : mode === 'test' ? 'Stripe TEST mode: use card 4242 4242 4242 4242, any future expiry and any CVC. No real money is charged.'
          : 'Live payments enabled.'}
      </div>
      <div className="grid g4">
        {plans.map((p) => (
          <div key={p.id} className="card plan">
            <div className="small muted" style={{ textTransform: 'uppercase', fontWeight: 700 }}>{p.kind === 'membership' ? 'Membership' : 'Class pack'}</div>
            <h2 style={{ margin: '4px 0' }}>{p.name}</h2>
            <div className="price">{aud(p.price_cents)}</div>
            <p className="small muted">{p.description}<br />Prices in AUD, GST inclusive.</p>
            <form action={checkoutAction}>
              <Csrf /><input type="hidden" name="plan_id" value={p.id} /><input type="hidden" name="back" value="/membership" />
              <button className="btn btn-block">{mode === 'demo' ? 'Buy (demo)' : 'Buy with Stripe'}</button>
            </form>
          </div>
        ))}
      </div>
      <div className="card">
        <h2>Payment history</h2>
        <div className="table-wrap"><table className="t"><thead><tr><th>Date</th><th>Item</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead><tbody>
          {history.map((h) => <tr key={h.id}><td>{d(h.created_at)}</td><td>{h.name}</td><td>{aud(h.amount_cents)}</td><td>{h.provider === 'demo' ? <span className="pill demo">demo</span> : 'Stripe'}</td><td><span className={`pill ${h.status}`}>{h.status}</span></td></tr>)}
          {history.length === 0 && <tr><td colSpan={5} className="muted">No payments yet.</td></tr>}
        </tbody></table></div>
        <p className="small muted">Dodds Fitness never sees or stores your card details.</p>
      </div>
    </>
  );
}
