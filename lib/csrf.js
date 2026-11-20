import { cookies } from 'next/headers';
import crypto from 'node:crypto';

export const CSRF_COOKIE = 'df_csrf';

export async function getCsrfToken() {
  return (await cookies()).get(CSRF_COOKIE)?.value || '';
}

/**
 * Double-submit token check: the hidden form field must match the HttpOnly, SameSite=Lax
 * cookie set by middleware. (Next.js server actions additionally reject cross-origin requests.)
 */
export async function verifyCsrf(formData) {
  const c = (await cookies()).get(CSRF_COOKIE)?.value || '';
  const f = formData.get('csrf');
  if (!c || typeof f !== 'string' || f.length !== c.length || !crypto.timingSafeEqual(Buffer.from(c), Buffer.from(f))) {
    throw new Error('Security check failed (CSRF). Please refresh the page and try again.');
  }
}
