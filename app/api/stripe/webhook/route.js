import { stripe } from '@/lib/stripe';
import { getDb } from '@/lib/db';
import { markPaid } from '@/lib/payments';

export const runtime = 'nodejs';

// Configure in Stripe Dashboard -> Developers -> Webhooks: event checkout.session.completed
export async function POST(req) {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secret) return new Response('Stripe not configured', { status: 404 });
  let event;
  try {
    event = s.webhooks.constructEvent(await req.text(), req.headers.get('stripe-signature'), secret);
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }
  if (event.type === 'checkout.session.completed' && event.data.object.payment_status === 'paid') {
    const pay = getDb().prepare('SELECT id FROM payments WHERE stripe_session_id = ?').get(event.data.object.id);
    if (pay) markPaid(pay.id);
  }
  return Response.json({ received: true });
}
