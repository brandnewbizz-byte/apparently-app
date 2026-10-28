/**
 * Public links shown in Settings → Support & legal.
 * Fill these in before submitting to the App Store / Play Store — both stores
 * require a privacy policy URL. Rows with an empty value are hidden.
 */
export const SUPPORT_EMAIL = '';
export const PRIVACY_POLICY_URL = '';
export const TERMS_URL = '';

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
