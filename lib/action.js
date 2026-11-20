import { redirect } from 'next/navigation';
import { verifyCsrf } from './csrf.js';
import { ZodError } from 'zod';

export function safeBack(v, fallback = '/dashboard') {
  return typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') && !v.includes('\\') ? v : fallback;
}
export function withParam(path, key, value) {
  const [p, q = ''] = path.split('?');
  const sp = new URLSearchParams(q);
  sp.delete('msg'); sp.delete('error');
  sp.set(key, value);
  return `${p}?${sp.toString()}`;
}
/** Wraps a server action: CSRF check, error -> ?error= redirect, success -> fn's destination. */
export async function run(formData, fn) {
  const back = safeBack(formData.get('back'));
  let dest;
  try {
    await verifyCsrf(formData);
    dest = await fn(back);
  } catch (e) {
    if (e?.digest?.startsWith?.('NEXT_REDIRECT')) throw e;
    const msg = e instanceof ZodError ? e.issues.map((i) => i.message).join('; ') : (e?.message || 'Something went wrong');
    dest = withParam(back, 'error', msg);
  }
  redirect(dest || back);
}
export const str = (fd, k) => { const v = fd.get(k); return typeof v === 'string' ? v : ''; };
