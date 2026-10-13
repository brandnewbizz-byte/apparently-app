/**
 * Native deep-link handling.
 *
 * IMPORTANT: the previous implementation returned `'/'` unconditionally, which
 * forced EVERY incoming deep link (password reset, profile links, and other
 * routed destinations) to the home screen.
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
