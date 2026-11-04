/**
 * Native deep-link handling.
 *
 * Passes app links (rork-app://live/room/{id}, rork-app://reset-password …)
 * through unchanged so expo-router opens the right screen.
 *
 * Shared web links (https://apparentlyappdashboard.nationalcompliancehub.com/app/…)
 * open the app directly when it's installed. Those carry the web app's "/app"
 * prefix, which the phone app doesn't use, so it's removed here:
 *   …/app/user/123?post=9   →  /user/123?post=9
 *   …/app/live/room/abc     →  /live/room/abc
 */
const WEB_HOST = 'apparentlyappdashboard.nationalcompliancehub.com';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (!path) return path;
    let p = path;
    if (/^https?:\/\//i.test(p)) {
      const u = new URL(p);
      if (u.hostname !== WEB_HOST) return p;
      p = `${u.pathname}${u.search}`;
    }
    if (p === '/app' || p === '/app/') return '/';
    if (p.startsWith('/app/')) return p.slice(4);
    return p;
  } catch {
    return path;
  }
}
