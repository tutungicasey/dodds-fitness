import Stripe from 'stripe';

/** Stripe is enabled only when a key is configured. Live keys are refused unless STRIPE_ALLOW_LIVE=true. */
export function stripeMode() {
  const key = process.env.STRIPE_SECRET_KEY || '';
  if (!key) return 'demo';
  if (key.startsWith('sk_test_') || key.startsWith('rk_test_')) return 'test';
  if (process.env.STRIPE_ALLOW_LIVE === 'true') return 'live';
  return 'demo'; // live key present but not explicitly allowed -> stay safe
}
let client;
export function stripe() {
  if (stripeMode() === 'demo') return null;
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}
export function appUrl(hostHeader, proto) {
  return process.env.APP_URL || `${proto || 'http'}://${hostHeader || 'localhost:3100'}`;
}
