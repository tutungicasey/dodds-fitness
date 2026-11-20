import './globals.css';
import Nav from '@/components/Nav';
import SwRegister from '@/components/SwRegister';
import { getUser } from '@/lib/auth';
import Link from 'next/link';

export const metadata = {
  title: { default: 'Dodds Fitness', template: '%s | Dodds Fitness' },
  description: 'Book classes, log workouts and nutrition, and track your progress at Dodds Fitness, Melbourne.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Dodds Fitness', statusBarStyle: 'default' },
};
export const viewport = { themeColor: '#111827', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }) {
  const user = await getUser();
  return (
    <html lang="en-AU">
      <body>
        <div className="demo-banner">DEMO PROTOTYPE · sample data only · payments are simulated unless Stripe test keys are configured</div>
        <Nav user={user} />
        <main className="container">{children}</main>
        <footer className="footer">
          <span>© {new Date().getFullYear()} Dodds Fitness · Melbourne, VIC</span>
          <Link href="/privacy">Privacy notice</Link>
        </footer>
        <SwRegister />
      </body>
    </html>
  );
}
