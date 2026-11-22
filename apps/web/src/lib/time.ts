const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "5m ago", "3h ago", "2d ago", then a short date. */
export function relativeTime(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  if (diff < 45_000) return 'just now';
  if (diff < HOUR) return `${Math.max(1, Math.round(diff / MINUTE))}m ago`;
  if (diff < DAY) return `${Math.round(diff / HOUR)}h ago`;
  if (diff < 14 * DAY) return `${Math.round(diff / DAY)}d ago`;
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** Compact age: "12m", "4h", "3d". */
export function age(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  if (diff < HOUR) return `${Math.max(1, Math.floor(diff / MINUTE))}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  return `${Math.floor(diff / DAY)}d`;
}

export function ageInDays(iso: string, now = Date.now()): number {
  return (now - new Date(iso).getTime()) / DAY;
}

/** Local date and time with the time zone, e.g. "22 Nov 2026, 14:03 GMT+1". */
export function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}
