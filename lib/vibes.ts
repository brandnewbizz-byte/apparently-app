/**
 * "Vibes": the kinds of plans people pick when they first open the app, and the
 * types the Home feed learns from. A bundle's vibes come from the vibe tags its
 * creator chose ("Who's it for?" in the builder), or are worked out from its
 * category, tags and title when there are none.
 */
export type VibeKey = 'date' | 'groups' | 'music' | 'sports' | 'getaway' | 'selfcare' | 'food' | 'family';

export const VIBES: { key: VibeKey; label: string; icon: string; tag: string; blurb: string }[] = [
  { key: 'date', label: 'Date nights', icon: '💕', tag: 'Date night', blurb: 'Dinner, a show, a ride there' },
  { key: 'groups', label: 'Big nights out', icon: '🎉', tag: 'Group night', blurb: 'Birthdays, parties, the crew' },
  { key: 'music', label: 'Live music', icon: '🎤', tag: 'Live music', blurb: 'Concerts and shows' },
  { key: 'sports', label: 'Game day', icon: '🏟️', tag: 'Game day', blurb: 'Games, fights, tailgates' },
  { key: 'getaway', label: 'Getaways', icon: '✈️', tag: 'Getaway', blurb: 'Weekends away and trips' },
  { key: 'selfcare', label: 'Self-care', icon: '🧖', tag: 'Self care', blurb: 'Spa days and slow mornings' },
  { key: 'food', label: 'Food & drink', icon: '🍽️', tag: 'Food & drink', blurb: 'Dinners, brunch, tastings' },
  { key: 'family', label: 'Family days', icon: '🎡', tag: 'Family', blurb: 'Days out with the kids' },
];

export const MAX_PICKS = 4;

export type GoingWith = 'solo' | 'partner' | 'friends' | 'family';
export const GOING_WITH: { key: GoingWith; label: string }[] = [
  { key: 'solo', label: 'Just me' },
  { key: 'partner', label: 'My partner' },
  { key: 'friends', label: 'Friends' },
  { key: 'family', label: 'Family' },
];
/** Who you go with → the vibe that gets a small head start. */
export const GOING_WITH_VIBE: Partial<Record<GoingWith, VibeKey>> = { partner: 'date', friends: 'groups', family: 'family' };

const VIBE_BY_TAG = new Map(VIBES.map((v) => [v.tag.toLowerCase(), v.key] as const));
export const isVibeTag = (tag: string) => VIBE_BY_TAG.has(tag.trim().toLowerCase());
export const vibeTag = (key: VibeKey) => VIBES.find((v) => v.key === key)!.tag;

/** Order matters: the first match is a bundle's main type. */
const RULES: [VibeKey, RegExp][] = [
  ['getaway', /\b(getaway|weekend trip|flights?|hotel|resort|island|vacation|nights? in|road trip|cabin|beach)\b/],
  ['sports', /\b(game day|game night|vs\.?|devils|knicks|nets|rangers|giants|jets|yankees|mets|red bulls|ufc|boxing|fight night|nfl|nba|nhl|mlb|stadium|tailgate|sports)\b/],
  ['music', /\b(concert|live music|tour|festival|jazz|r&b|hip.?hop|band|dj set|orchestra|symphony|opera)\b/],
  ['selfcare', /\b(spa|massage|self.?care|facial|nails|manicure|pedicure|yoga|wellness|sauna)\b/],
  ['date', /\b(date night|for two|for 2|couples?|romantic|anniversary|valentine'?s?|proposal|dinner \+ (a )?movie)\b/],
  ['groups', /\b(birthday|group|party|bachelor(ette)?|squad|girls'? night|guys'? night|for (6|7|8|9|10|12)\b|celebrat)/],
  ['family', /\b(family|kids?|children|toddler|zoo|aquarium)\b/],
  ['food', /\b(dinner|brunch|lunch|food|chef|tasting|wine|cocktails?|restaurant|rodizio|steakhouse|sushi|bbq)\b/],
];
const BY_CATEGORY: Record<string, VibeKey> = { travel: 'getaway', wellness: 'selfcare', beauty: 'selfcare', dining: 'food' };

/** A bundle's vibes, main one first. Never empty: 'other' when nothing fits. */
export function vibesOf(b: { category?: string; tags?: string[]; title?: string; description?: string }): string[] {
  const out: string[] = [];
  const add = (k: string) => { if (!out.includes(k)) out.push(k); };
  for (const t of b.tags || []) { const k = VIBE_BY_TAG.get(t.trim().toLowerCase()); if (k) add(k); }
  const text = [b.title, ...(b.tags || []), b.description].filter(Boolean).join(' · ').toLowerCase();
  if (!out.length && b.category && BY_CATEGORY[b.category]) add(BY_CATEGORY[b.category]);
  for (const [k, re] of RULES) if (re.test(text)) add(k);
  if (b.category && BY_CATEGORY[b.category]) add(BY_CATEGORY[b.category]);
  return out.length ? out : ['other'];
}
