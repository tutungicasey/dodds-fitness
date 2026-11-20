import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { markPaid } from '@/lib/payments';

// Stripe redirects here after Checkout. We verify the session server-side with Stripe (never trust the URL alone).
export default async function StripeSuccess({ searchParams }) {
  const me = await requireUser();
  const { session_id } = await searchParams;
  const s = stripe();
  if (!s || typeof session_id !== 'string') redirect('/membership');
  const pay = getDb().prepare('SELECT * FROM payments WHERE stripe_session_id = ? AND user_id = ?').get(session_id, me.id);
  if (!pay) redirect('/membership?error=' + encodeURIComponent('Payment not found.'));
  const session = await s.checkout.sessions.retrieve(session_id);
  if (session.payment_status === 'paid') {
    markPaid(pay.id);
    redirect('/membership?msg=' + encodeURIComponent('Payment received - thank you! Your plan is active.'));
  }
  redirect('/membership?error=' + encodeURIComponent('Payment not completed yet.'));
}
