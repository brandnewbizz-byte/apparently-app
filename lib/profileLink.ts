/** Public web address of the app (the same build as the phone app, on the dashboard site). */
export const WEB_APP_URL = 'https://apparentlyappdashboard.nationalcompliancehub.com/app';

/**
 * The link inside someone's profile QR code. Opening it shows their page with a
 * one-tap Follow (`f=1`). Works from any phone camera, app installed or not.
 */
export const profileFollowUrl = (userId: string) => `${WEB_APP_URL}/user/${userId}?f=1`;
