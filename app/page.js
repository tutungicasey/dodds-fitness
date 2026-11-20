import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';

export default async function Home() {
  if (await getUser()) redirect('/dashboard');
  return (
    <>
      <section className="hero">
        <h1>Train smarter at Dodds Fitness</h1>
        <p>Book HIIT, Spin, Yoga and Strength classes, keep a training and food diary, and track your progress with your coach - all in one app you can install on your phone.</p>
        <div className="actions" style={{ marginTop: 16 }}>
          <Link className="btn" href="/signup">Become a member</Link>
          <Link className="btn btn-ghost" style={{ color: '#fff', borderColor: '#ffffff55' }} href="/login">Log in</Link>
        </div>
      </section>
      <div className="grid g3">
        <div className="card"><h2>Class booking</h2><p className="muted">See the weekly timetable, book in seconds, join the waitlist when it&apos;s full.</p></div>
        <div className="card"><h2>Your diary</h2><p className="muted">Log workouts (sets, reps and kg lifted), meals and macros, body measurements and notes.</p></div>
        <div className="card"><h2>Coaching</h2><p className="muted">Your trainer can build programs and leave notes to keep you on track.</p></div>
      </div>
    </>
  );
}
