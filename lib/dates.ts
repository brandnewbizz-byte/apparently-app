/** YYYY-MM-DD for a date in the user's own time zone (toISOString uses UTC,
 *  which made "today" flip to tomorrow every evening in the Americas). */
export function localDateKey(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses a YYYY-MM-DD key as a local date (noon, so DST never shifts the day). */
export function dateFromKey(key: string): Date {
  return new Date(`${key}T12:00:00`);
}

/** "9:00 AM" / "09:00" / "21:30" → minutes after midnight (null if unparseable). */
export function parseTimeToMinutes(time?: string | null): number | null {
  if (!time) return null;
  const m = time.trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3]?.toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** minutes after midnight → "9:00 AM" */
export function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`;
}

/** Any accepted time string → "9:00 AM" (returns the input if it can't be parsed). */
export function formatTime12(time?: string | null): string {
  const mins = parseTimeToMinutes(time);
  return mins === null ? (time || '') : formatMinutes(mins);
}
