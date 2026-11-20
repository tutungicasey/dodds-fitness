import Link from 'next/link';
import Logo from './Logo';
import Csrf from './Csrf';
import { logoutAction } from '@/app/actions/auth';

export default function Nav({ user }) {
  const links = !user ? [['/login', 'Log in'], ['/signup', 'Join']] : [
    ['/dashboard', 'Home'], ['/timetable', 'Classes'], ['/bookings', 'My bookings'], ['/diary', 'Diary'], ['/membership', 'Membership'], ['/profile', 'Profile'],
    ...(user.role !== 'member' ? [['/trainer', 'Clients']] : []),
    ...(user.role === 'admin' ? [['/admin', 'Admin']] : []),
  ];
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href={user ? '/dashboard' : '/'} className="brand"><Logo /> <span>Dodds Fitness</span></Link>
        {user && (
          <form action={logoutAction} className="logout">
            <Csrf />
            <span className="who">{user.name.replace(/ \(Demo.*\)/, '')} <em className={`role role-${user.role}`}>{user.role}</em></span>
            <button className="btn btn-ghost btn-sm">Log out</button>
          </form>
        )}
      </div>
      <nav className="mainnav" aria-label="Main">
        {links.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
      </nav>
    </header>
  );
}
