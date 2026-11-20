// Simple in-memory fixed-window limiter. Fine for a single server; use Redis/Upstash when scaling out.
const buckets = globalThis.__dfRate || (globalThis.__dfRate = new Map());
export function hit(key, limit, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset < now) { b = { count: 0, reset: now + windowMs }; buckets.set(key, b); }
  b.count++;
  return { ok: b.count <= limit, retryAfterSec: Math.ceil((b.reset - now) / 1000) };
}
export function clearKey(key) { buckets.delete(key); }
