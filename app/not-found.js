import Link from 'next/link';
export default function NotFound() {
  return <div className="card auth"><h1>Not found</h1><p className="muted">That page doesn&apos;t exist or you don&apos;t have access.</p><Link className="btn" href="/dashboard">Go home</Link></div>;
}
