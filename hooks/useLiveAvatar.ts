import { useAuth } from '../contexts/AuthContext';

/**
 * Resolves a live avatar URL for feed posts & comments.
 *
 * If the given userId matches the currently authenticated user,
 * returns the live authUser.avatar — so profile changes are
 * immediately reflected everywhere in the feed.
 *
 * Otherwise falls back to the statically stored avatar URL.
 */
export function useLiveAvatar(userId?: string, fallbackUrl?: string): string {
  const { user } = useAuth();

  if (userId && user && userId === user.id) {
    return user.avatar || fallbackUrl || '';
  }

  return fallbackUrl || '';
}

export default useLiveAvatar;
