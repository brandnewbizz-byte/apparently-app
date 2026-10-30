/**
 * Public links shown in Settings → Support & legal.
 * Fill these in before submitting to the App Store / Play Store — both stores
 * require a privacy policy URL. Rows with an empty value are hidden.
 */
export const SUPPORT_EMAIL = 'concierge@nationalcompliancehub.com';
export const PRIVACY_POLICY_URL = 'https://apparentlyappdashboard.nationalcompliancehub.com/privacy.html';
export const SUPPORT_URL = 'https://apparentlyappdashboard.nationalcompliancehub.com/support.html';
export const TERMS_URL = 'https://apparentlyappdashboard.nationalcompliancehub.com/terms.html';

/** Username rules — must match the `profiles_username_format` DB check. */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const USERNAME_PATTERN = /^[a-z0-9._]+$/;

/** Returns an error message, or null when the handle is valid. */
export function usernameProblem(raw: string): string | null {
  const u = raw.trim().toLowerCase();
  if (u.length < USERNAME_MIN) return `At least ${USERNAME_MIN} characters.`;
  if (u.length > USERNAME_MAX) return `${USERNAME_MAX} characters max.`;
  if (!USERNAME_PATTERN.test(u)) return 'Only letters, numbers, dots and underscores.';
  return null;
}

/**
 * RevenueCat public SDK keys (Project settings → API keys in RevenueCat).
 * These are public keys and safe to ship in the app. Leave empty to hide
 * purchases (the app then shows plans but can't sell them yet).
 */
export const REVENUECAT_IOS_KEY = '';
export const REVENUECAT_ANDROID_KEY = 'goog_nRefAfycfUwcZwzbKLuUVNdrdsS';
