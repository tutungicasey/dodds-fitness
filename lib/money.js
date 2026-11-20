export const CURRENCY = 'AUD';
export function aud(cents) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format((cents || 0) / 100);
}
