import type { Plan } from '@/contexts/PlannerContext';
import { parseTimeToMinutes } from '@/lib/dates';

export const BLOCK_CATEGORIES = [
  { id: 'work', label: 'Work', color: '#0EA5E9' },
  { id: 'personal', label: 'Personal', color: '#EC4899' },
  { id: 'health', label: 'Health', color: '#10B981' },
  { id: 'learning', label: 'Learning', color: '#8B5CF6' },
  { id: 'social', label: 'Social', color: '#F59E0B' },
  { id: 'errands', label: 'Errands', color: '#6366F1' },
  { id: 'calls', label: 'Calls', color: '#14B8A6' },
  { id: 'focus', label: 'Focus', color: '#EF4444' },
  { id: 'break', label: 'Break', color: '#78716C' },
  { id: 'other', label: 'Other', color: '#6B7280' },
] as const;

const LOCATION_LABELS: Record<string, string> = {
  home: 'Home', hotel: 'Hotel', airbnb: 'Airbnb', coffee: 'Coffee shop', coworking: 'Co-working',
};
const HELP_LABELS: Record<string, string> = { va: 'Assistant', delivery: 'Delivery', errands: 'Errands', other: 'Help' };

export interface PlanSummary {
  title: string;
  /** Minutes after midnight, or null for all-day items. */
  startMins: number | null;
  durationMins: number | null;
  color: string;
  label: string;
  subtitle: string;
  kind: 'block' | 'job' | 'day' | 'quick';
}

/**
 * The planner stores three shapes of plan (time blocks, accepted jobs and full
 * "plan my day" plans, plus older quick plans that packed the time into the
 * label). This turns any of them into one consistent row.
 */
export function summarizePlan(plan: Plan): PlanSummary {
  const d = plan.plan;
  const cb = d?.custom_block;
  if (cb) {
    return {
      title: cb.title || plan.date_label || 'Untitled',
      startMins: parseTimeToMinutes(cb.start_time),
      durationMins: cb.duration_minutes || null,
      color: cb.category_color || '#6B7280',
      label: cb.category_label || 'Block',
      subtitle: [cb.location, cb.description].filter(Boolean).join(' · '),
      kind: 'block',
    };
  }
  const job = d?.imported_job;
  if (job) {
    return {
      title: job.title || `${job.type} job`,
      startMins: parseTimeToMinutes(job.pickup_time),
      durationMins: job.hours ? Math.round(parseFloat(job.hours) * 60) || null : null,
      color: '#10B981',
      label: 'Job',
      subtitle: [job.pickup_location, job.dropoff_location].filter(Boolean).join(' → '),
      kind: 'job',
    };
  }
  // Older quick plans: "12:00 PM — Coffee with Sam"
  const legacy = plan.date_label?.match(/^(\d{1,2}:\d{2}\s*[AP]M)\s+[—-]\s+(.+)$/i);
  if (legacy) {
    return {
      title: legacy[2],
      startMins: parseTimeToMinutes(legacy[1]),
      durationMins: null,
      color: '#0095F6',
      label: 'Plan',
      subtitle: d?.notes || '',
      kind: 'quick',
    };
  }
  // Full "plan my day" plan
  const loc = d?.location_type || plan.location_type;
  const help = (d?.assistance || []).map((a) => HELP_LABELS[a] || a);
  const bits = [
    loc ? LOCATION_LABELS[loc] || plan.custom_location || loc : null,
    (d?.transport || plan.transport) === 'chauffeur' ? 'Chauffeur' : null,
    help.length ? help.join(', ') : null,
  ].filter(Boolean);
  return {
    title: 'Day plan',
    startMins: parseTimeToMinutes(d?.chauffeur?.pickupTime),
    durationMins: null,
    color: '#7B61FF',
    label: 'Day plan',
    subtitle: bits.join(' · '),
    kind: 'day',
  };
}

export function sortByTime(a: { summary: PlanSummary }, b: { summary: PlanSummary }) {
  const am = a.summary.startMins ?? -1;
  const bm = b.summary.startMins ?? -1;
  return am - bm;
}

export function formatDuration(mins: number | null): string {
  if (!mins) return '';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
