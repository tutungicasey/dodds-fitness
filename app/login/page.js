import Link from 'next/link';
import { redirect } from 'next/navigation';
import Csrf from '@/components/Csrf';
import Flash from '@/components/Flash';
import { loginAction } from '@/app/actions/auth';
import { getUser } from '@/lib/auth';

export const metadata = { title: 'Log in' };

export default async function Login({ searchParams }) {
  if (await getUser()) redirect('/dashboard');
  const sp = await searchParams;
  return (
    <div className="auth">
      <h1>Log in</h1>
      <Flash sp={sp} />
      <form action={loginAction} className="card">
        <Csrf />
        <input type="hidden" name="back" value="/login" />
        <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
        <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
        <button className="btn btn-block">Log in</button>
        <p className="small muted" style={{ marginBottom: 0 }}>New here? <Link href="/signup">Create an account</Link></p>
      </form>
      <div className="card small">
        <strong>Demo logins</strong> <span className="pill demo">demo</span>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          <li>Admin: admin@doddsfitness.demo / DemoAdmin!2026</li>
          <li>Trainer: trainer@doddsfitness.demo / DemoTrainer!2026</li>
          <li>Member: member@doddsfitness.demo / DemoMember!2026</li>
        </ul>
      </div>
    </div>
  );
}
