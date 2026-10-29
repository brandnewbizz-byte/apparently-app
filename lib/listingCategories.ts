/** Categories shared by bundles and skill deals (keys are stored in the database). */
export const LISTING_CATEGORIES = [
  { key: 'home', label: 'Home', icon: '🏠' },
  { key: 'cleaning', label: 'Cleaning', icon: '🧹' },
  { key: 'dining', label: 'Food', icon: '🍽️' },
  { key: 'beauty', label: 'Beauty', icon: '💄' },
  { key: 'wellness', label: 'Wellness', icon: '🧘' },
  { key: 'fitness', label: 'Fitness', icon: '💪' },
  { key: 'pets', label: 'Pets', icon: '🐾' },
  { key: 'creative', label: 'Creative', icon: '🎨' },
  { key: 'tech', label: 'Tech', icon: '💻' },
  { key: 'education', label: 'Lessons', icon: '📚' },
  { key: 'events', label: 'Events', icon: '🎉' },
  { key: 'travel', label: 'Travel', icon: '✈️' },
  { key: 'outdoor', label: 'Outdoor', icon: '🌲' },
  { key: 'transport', label: 'Rides', icon: '🚗' },
  { key: 'repair', label: 'Repair', icon: '🔧' },
  { key: 'other', label: 'Other', icon: '🛠️' },
] as const;

export const categoryMeta = (key?: string | null) =>
  LISTING_CATEGORIES.find((c) => c.key === key) || LISTING_CATEGORIES[LISTING_CATEGORIES.length - 1];

/** Tag ideas per category, offered as one-tap chips. */
export const TAG_IDEAS: Record<string, string[]> = {
  home: ['Same day', 'Weekend', 'Family'],
  cleaning: ['Deep clean', 'Move out', 'Eco'],
  dining: ['Private chef', 'Meal prep', 'Vegan'],
  beauty: ['Hair', 'Nails', 'Makeup'],
  wellness: ['Massage', 'Self care', 'Spa'],
  fitness: ['Personal training', 'Beginner', 'Outdoor'],
  pets: ['Dog walking', 'Grooming', 'Pet sitting'],
  creative: ['Photography', 'Design', 'Music'],
  tech: ['Setup', 'Repair', 'Websites'],
  education: ['Tutoring', 'Online', 'Kids'],
  events: ['Party', 'Birthday', 'DJ', 'Concert', 'Sports'],
  travel: ['Getaway', 'Flights + hotel', 'Island', 'Weekend trip'],
  outdoor: ['Lawn', 'Garden', 'Adventure'],
  transport: ['Airport', 'Chauffeur', 'Moving'],
  repair: ['Plumbing', 'Electrical', 'Handyman'],
  other: ['Local', 'Flexible', 'Popular'],
};

export const SKILL_EMOJIS = [
  '🛠️', '🧹', '👨‍🍳', '🐕', '📸', '📚', '💪', '🎨', '💻', '🧘', '🌲', '🎉', '🚗', '💄', '🔧', '🏠',
  '🍽️', '🐾', '🎵', '📱', '✂️', '🪴', '🧺', '🎂', '🗣️', '🏋️', '🎯', '🧵', '📊', '🎬', '💡', '💅',
  '🎟️', '✈️', '🏝️', '🏟️', '🎤',
];

/** How long a skill deal stays up. */
export const DEAL_LENGTHS: { key: string; label: string; hours: number | null }[] = [
  { key: '24h', label: '24 hours', hours: 24 },
  { key: '3d', label: '3 days', hours: 72 },
  { key: '7d', label: '1 week', hours: 168 },
  { key: '30d', label: '30 days', hours: 720 },
  { key: 'none', label: 'No end date', hours: null },
];

export const WHEN_IDEAS = ['Flexible', 'Weekends', 'Weekdays', 'This week', 'Evenings'];

/** "12.5" -> 12.5; anything else -> 0. Keeps at most two decimals. */
export function parseMoney(v: string): number {
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** Text input filter for money: digits and one dot, 2 decimals. */
export function cleanMoneyInput(v: string): string {
  let out = v.replace(/[^0-9.]/g, '');
  const dot = out.indexOf('.');
  if (dot >= 0) out = out.slice(0, dot + 1) + out.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  return out.slice(0, 8);
}

export const formatMoney = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);
