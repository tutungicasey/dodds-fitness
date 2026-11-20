export const metadata = { title: 'Offline' };
export const dynamic = 'force-static';
export default function Offline() {
  return <div className="card auth"><h1>You&apos;re offline</h1><p className="muted">Dodds Fitness needs a connection to load your bookings and diary. Check your connection and try again.</p></div>;
}
