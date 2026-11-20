import { NextResponse } from 'next/server';

// Ensures every visitor has a CSRF token cookie (double-submit pattern) before any form renders.
export function middleware(req) {
  const existing = req.cookies.get('df_csrf')?.value;
  if (existing) return NextResponse.next();
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const reqHeaders = new Headers(req.headers);
  const cookie = req.headers.get('cookie');
  reqHeaders.set('cookie', (cookie ? cookie + '; ' : '') + `df_csrf=${token}`);
  const res = NextResponse.next({ request: { headers: reqHeaders } });
  const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production';
  res.cookies.set('df_csrf', token, { httpOnly: true, sameSite: 'lax', secure, path: '/' });
  return res;
}

export const config = { matcher: ['/((?!_next/static|_next/image|icons|sw.js|manifest.webmanifest|favicon.ico).*)'] };
