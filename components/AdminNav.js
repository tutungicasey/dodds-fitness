import Link from 'next/link';
const L = [['/admin', 'Dashboard'], ['/admin/members', 'Members'], ['/admin/classes', 'Classes'], ['/admin/bookings', 'Bookings'], ['/admin/payments', 'Revenue'], ['/admin/audit', 'Audit log']];
export default function AdminNav({ active }) {
  return <div className="tabs">{L.map(([h, l]) => <Link key={h} href={h} className={active === h ? 'active' : ''}>{l}</Link>)}</div>;
}
