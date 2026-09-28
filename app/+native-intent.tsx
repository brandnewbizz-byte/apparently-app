/**
 * Native deep-link handling.
 *
 * IMPORTANT: the previous implementation returned `'/'` unconditionally, which
 * forced EVERY incoming deep link (invite links, password reset, profile links)
 * to the home screen. That silently broke `rork-app://live/room/{id}` and
 * `rork-app://reset-password`.
 *
 * We now pass the incoming path through unchanged so expo-router can resolve it
 * to the correct screen. Returning the path verbatim is a no-op redirect that
 * preserves the deep-link destination.
 */
export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  return path;
}
