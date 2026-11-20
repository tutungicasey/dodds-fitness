export default function Logo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#111827" />
      <rect x="10" y="28" width="6" height="8" rx="2" fill="#14b8a6" />
      <rect x="48" y="28" width="6" height="8" rx="2" fill="#14b8a6" />
      <rect x="16" y="22" width="6" height="20" rx="2" fill="#fff" />
      <rect x="42" y="22" width="6" height="20" rx="2" fill="#fff" />
      <rect x="22" y="30" width="20" height="4" rx="2" fill="#fff" />
    </svg>
  );
}
