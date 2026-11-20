import Link from 'next/link';
import Csrf from '@/components/Csrf';
import Flash from '@/components/Flash';
import { signupAction } from '@/app/actions/auth';

export const metadata = { title: 'Join' };

export default async function Signup({ searchParams }) {
  const sp = await searchParams;
  return (
    <div className="auth">
      <h1>Create your account</h1>
      <Flash sp={sp} />
      <form action={signupAction} className="card">
        <Csrf />
        <input type="hidden" name="back" value="/signup" />
        <div className="field"><label htmlFor="name">Full name</label><input id="name" name="name" autoComplete="name" required maxLength={80} /></div>
        <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={160} /></div>
        <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} />
          <div className="small muted">At least 10 characters, including letters and numbers.</div></div>
        <div className="field"><label><input type="checkbox" name="consent" required /> I have read the <Link href="/privacy">privacy notice</Link>.</label></div>
        <button className="btn btn-block">Create account</button>
        <p className="small muted" style={{ marginBottom: 0 }}>Already a member? <Link href="/login">Log in</Link></p>
      </form>
    </div>
  );
}
