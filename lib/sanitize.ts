/**
 * Input sanitization utilities.
 * Trims, normalizes, and enforces limits on user-generated content
 * before it reaches Supabase or display surfaces.
 */

const MAX_BIO_LENGTH = 500;
const MAX_CAPTION_LENGTH = 2000;
const MAX_BUNDLE_DESC_LENGTH = 1000;
const MAX_SKILL_DESC_LENGTH = 500;
const MAX_FULL_NAME_LENGTH = 100;
const MAX_USERNAME_LENGTH = 30;
const MAX_LOCATION_LENGTH = 100;

/** Strip control characters and normalize whitespace */
function clean(raw: string): string {
  return raw
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // strip control chars
    .replace(/\s+/g, ' ')
    .trim();
}

/** Truncate to maxLen chars, breaking at word boundaries when possible */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  // Try to break at the last space before maxLen
  const cutoff = text.lastIndexOf(' ', maxLen);
  return cutoff > maxLen * 0.7 ? text.slice(0, cutoff) : text.slice(0, maxLen);
}

// ─── Field-specific sanitizers ───

export function sanitizeBio(bio: string | null | undefined): string | null {
  if (!bio) return null;
  return truncate(clean(bio), MAX_BIO_LENGTH) || null;
}

export function sanitizeCaption(caption: string | null | undefined): string {
  if (!caption) return '';
  return truncate(clean(caption), MAX_CAPTION_LENGTH);
}

export function sanitizeBundleDesc(desc: string | null | undefined): string {
  if (!desc) return '';
  return truncate(clean(desc), MAX_BUNDLE_DESC_LENGTH);
}

export function sanitizeSkillDesc(desc: string | null | undefined): string {
  if (!desc) return '';
  return truncate(clean(desc), MAX_SKILL_DESC_LENGTH);
}

export function sanitizeFullName(name: string | null | undefined): string {
  if (!name) return '';
  return truncate(clean(name), MAX_FULL_NAME_LENGTH);
}

export function sanitizeUsername(username: string | null | undefined): string {
  if (!username) return '';
  // Only allow letters, numbers, underscores, dots
  const cleaned = username.toLowerCase().replace(/[^a-z0-9_.]/g, '');
  return truncate(cleaned, MAX_USERNAME_LENGTH);
}

export function sanitizeLocation(location: string | null | undefined): string {
  if (!location) return '';
  return truncate(clean(location), MAX_LOCATION_LENGTH);
}

/**
 * Quick check: does a string exceed safe length?
 * Use before expensive operations.
 */
export function isWithinLimit(text: string | null | undefined, maxLen: number): boolean {
  if (!text) return true;
  return text.length <= maxLen;
}
