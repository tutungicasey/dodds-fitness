'use server';
import { headers } from 'next/headers';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { run } from '@/lib/action';
import { stripe, stripeMode, appUrl } from '@/lib/stripe';
import { markPaid } from '@/lib/payments';

export async function checkoutAction(fd) {
  await run(fd, async () => {
    const me = await requireUser();
    const db = getDb();
    const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND active = 1').get(Number(fd.get('plan_id')));
    if (!plan) throw new Error('Plan not found.');
    const mode = stripeMode();
    const provider = mode === 'demo' ? 'demo' : 'stripe';
    const paymentId = db.prepare("INSERT INTO payments (user_id, plan_id, amount_cents, currency, provider, status) VALUES (?,?,?,'AUD',?,'pending')")
      .run(me.id, plan.id, plan.price_cents, provider).lastInsertRowid;
    if (provider === 'demo') return `/checkout/demo/${paymentId}`;
    const h = await headers();
    const base = appUrl(h.get('x-forwarded-host') || h.get('host'), h.get('x-forwarded-proto'));
    // Stripe-hosted Checkout: card details are entered on Stripe's page and never touch this app.
    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      customer_email: me.email,
      client_reference_id: String(me.id),
      metadata: { payment_id: String(paymentId), user_id: String(me.id), plan_id: String(plan.id) },
      line_items: [{ quantity: 1, price_data: { currency: 'aud', unit_amount: plan.price_cents, product_data: { name: `Dodds Fitness - ${plan.name}`, description: plan.description || undefined } } }],
      success_url: `${base}/membership/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/membership?error=${encodeURIComponent('Payment cancelled.')}`,
    });
    db.prepare('UPDATE payments SET stripe_session_id = ? WHERE id = ?').run(session.id, paymentId);
    return session.url;
  });
}

export async function demoPayAction(fd) {
  await run(fd, async () => {
    const me = await requireUser();
    if (stripeMode() !== 'demo') throw new Error('Demo payments are disabled when Stripe is configured.');
    const pay = getDb().prepare("SELECT * FROM payments WHERE id = ? AND user_id = ? AND provider = 'demo'").get(Number(fd.get('payment_id')), me.id);
    if (!pay || pay.status !== 'pending') throw new Error('This payment is no longer pending.');
    markPaid(pay.id);
    return '/membership?msg=' + encodeURIComponent('DEMO payment complete - no real money was charged. Your plan is now active.');
  });
}

export async function demoCancelAction(fd) {
  await run(fd, async () => {
    const me = await requireUser();
    getDb().prepare("UPDATE payments SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status = 'pending'").run(Number(fd.get('payment_id')), me.id);
    return '/membership?error=' + encodeURIComponent('Payment cancelled.');
  });
}
