export const TZ = 'Australia/Melbourne';

function parts(date = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  const hour = p.hour === '24' ? '00' : p.hour;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${hour}:${p.minute}` };
}
/** Current Melbourne local time as 'YYYY-MM-DD HH:MM' (sortable). */
export function nowLocal() { const p = parts(); return `${p.date} ${p.time}`; }
export function today() { return parts().date; }
export function toLocal(date) { const p = parts(date); return `${p.date} ${p.time}`; }
export function addDays(d, n) { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
/** 0 = Sunday */
export function dow(d) { return new Date(d + 'T00:00:00Z').getUTCDay(); }
export function mondayOf(d) { const w = dow(d); return addDays(d, w === 0 ? -6 : 1 - w); }
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function fmtDate(d, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Date(d.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-AU', { ...opts, timeZone: 'UTC' });
}
export function fmtTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`;
}
export function fmtDateTime(local) { return `${fmtDate(local)} ${fmtTime(local.slice(11, 16))}`; }
export function isValidDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z')); }
