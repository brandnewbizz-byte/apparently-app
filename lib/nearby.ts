/**
 * How close a card is to the viewer, from the free-text places people type
 * ("Newark, NJ", "Brooklyn NY", "Comes to you"). No GPS needed.
 *
 *   1    same city / town
 *   0.7  comes to you or online (works anywhere)
 *   0.5  same state
 *   0    somewhere else
 *   undefined  we can't tell (no place on the card or the profile)
 */
const STATES: Record<string, string> = {
  alabama: 'al', alaska: 'ak', arizona: 'az', arkansas: 'ar', california: 'ca', colorado: 'co', connecticut: 'ct',
  delaware: 'de', florida: 'fl', georgia: 'ga', hawaii: 'hi', idaho: 'id', illinois: 'il', indiana: 'in', iowa: 'ia',
  kansas: 'ks', kentucky: 'ky', louisiana: 'la', maine: 'me', maryland: 'md', massachusetts: 'ma', michigan: 'mi',
  minnesota: 'mn', mississippi: 'ms', missouri: 'mo', montana: 'mt', nebraska: 'ne', nevada: 'nv', 'new hampshire': 'nh',
  'new jersey': 'nj', 'new mexico': 'nm', 'new york': 'ny', 'north carolina': 'nc', 'north dakota': 'nd', ohio: 'oh',
  oklahoma: 'ok', oregon: 'or', pennsylvania: 'pa', 'rhode island': 'ri', 'south carolina': 'sc', 'south dakota': 'sd',
  tennessee: 'tn', texas: 'tx', utah: 'ut', vermont: 'vt', virginia: 'va', washington: 'wa', 'west virginia': 'wv',
  wisconsin: 'wi', wyoming: 'wy', 'district of columbia': 'dc',
};
const ABBR = new Set(Object.values(STATES));
const ANYWHERE = /\b(comes to you|online|remote|virtual|anywhere|your place|your home|mobile)\b/i;

export interface Place { places: string[]; state?: string; anywhere: boolean }

export function parsePlace(text?: string | null): Place | undefined {
  const raw = (text || '').trim();
  if (!raw) return undefined;
  if (ANYWHERE.test(raw)) return { places: [], anywhere: true };
  const clean = raw.toLowerCase().replace(/\b\d{5}(-\d{4})?\b/g, ' ').replace(/[^a-z,\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return undefined;
  const parts = clean.split(',').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return undefined;
  let state: string | undefined;
  // The state is a full name or a 2-letter code at the end: "newark nj", "newark, new jersey".
  const last = parts[parts.length - 1];
  for (const [name, ab] of Object.entries(STATES)) {
    if (last === name || last.endsWith(` ${name}`)) {
      state = ab;
      parts[parts.length - 1] = last.slice(0, last.length - name.length).trim();
      break;
    }
  }
  if (!state) {
    const words = last.split(' ');
    const code = words[words.length - 1];
    if (ABBR.has(code) && (words.length > 1 || parts.length > 1)) {
      state = code;
      parts[parts.length - 1] = words.slice(0, -1).join(' ');
    }
  }
  return { places: parts.filter(Boolean), state, anywhere: false };
}

export function nearness(viewer?: string | null, item?: string | null): number | undefined {
  const it = parsePlace(item);
  if (!it) return undefined;
  if (it.anywhere) return 0.7;
  const me = parsePlace(viewer);
  if (!me || me.anywhere) return undefined;
  const sameTown = me.places.some((a) => it.places.some((b) => a === b || (a.length > 3 && b.includes(a)) || (b.length > 3 && a.includes(b))));
  if (sameTown && (!me.state || !it.state || me.state === it.state)) return 1;
  if (me.state && it.state) return me.state === it.state ? 0.5 : 0;
  return undefined;
}

const WEEKDAY = /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s*/i;

/** A date written on a card ("2026-12-22", "Dec 22", "Tue Dec 22 – Sun Dec 27") → ms, or undefined. */
export function parseWhen(text?: string | null, now = Date.now()): number | undefined {
  const t = (text || '').trim();
  if (!t) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const ms = Date.parse(`${t.slice(0, 10)}T12:00:00`);
    return Number.isNaN(ms) ? undefined : ms;
  }
  const first = t.split(/\s[-–]\s|\sto\s/i)[0].replace(WEEKDAY, '').trim();
  if (/\d{4}/.test(first)) {
    const ms = Date.parse(first);
    return Number.isNaN(ms) ? undefined : ms;
  }
  if (!/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b/i.test(first)) return undefined;
  const year = new Date(now).getFullYear();
  let ms = Date.parse(`${first} ${year}`);
  if (Number.isNaN(ms)) return undefined;
  if (ms < now - 30 * 86_400_000) ms = Date.parse(`${first} ${year + 1}`); // "Jan 5" seen in December
  return Number.isNaN(ms) ? undefined : ms;
}
