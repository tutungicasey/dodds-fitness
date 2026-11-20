import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { aud } from '@/lib/money';
import Csrf from '@/components/Csrf';
import { demoPayAction, demoCancelAction } from '@/app/actions/payments';

export const metadata = { title: 'Demo checkout' };

export default async function DemoCheckout({ params }) {
  const me = await requireUser();
  const { id } = await params;
  const pay = getDb().prepare("SELECT pay.*, p.name, p.description FROM payments pay JOIN plans p ON p.id = pay.plan_id WHERE pay.id = ? AND pay.user_id = ? AND pay.provider = 'demo'").get(Number(id), me.id);
  if (!pay) notFound();
  return (
    <div className="auth">
      <h1>Checkout</h1>
      <div className="card demo-pay">
        <span className="pill demo">Demo payment - simulated</span>
        <h2 style={{ marginTop: 10 }}>{pay.name}</h2>
        <p className="muted small">{pay.description}</p>
        <p style={{ fontSize: '1.6rem', fontWeight: 800, margin: '8px 0' }}>{aud(pay.amount_cents)} <span className="small muted">AUD incl. GST</span></p>
        <p className="small">This is a <strong>mock checkout</strong> for the prototype. No card is requested and nothing is charged. In production this step is replaced by Stripe&apos;s secure hosted checkout page.</p>
        {pay.status === 'pending' ? (
          <div className="actions">
            <form action={demoPayAction}><Csrf /><input type="hidden" name="payment_id" value={pay.id} /><input type="hidden" name="back" value="/membership" /><button className="btn">Complete demo payment</button></form>
            <form action={demoCancelAction}><Csrf /><input type="hidden" name="payment_id" value={pay.id} /><input type="hidden" name="back" value="/membership" /><button className="btn btn-ghost">Cancel</button></form>
          </div>
        ) : <p><span className={`pill ${pay.status}`}>{pay.status}</span></p>}
      </div>
    </div>
  );
}
