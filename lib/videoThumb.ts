/**
 * Video cover images ("thumbnails"), the way Instagram does it: one still
 * frame from the video is saved as the post's cover. It shows in the profile
 * grid, in the feed before the video starts, and anywhere a picture of the
 * post is needed. We take the frame 1 second into the posted (trimmed) part,
 * or the first frame for very short clips.
 */
import { Platform } from 'react-native';
import { createVideoPlayer } from 'expo-video';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { parseClip } from '@/lib/videoClip';

/** Second (from the start of the posted part) used for the cover. */
export const COVER_AT_SECS = 1;

export function coverTime(videoUri: string, duration?: number): number {
  const { clip } = parseClip(videoUri);
  const start = clip.start || 0;
  let t = start + COVER_AT_SECS;
  if (clip.end && t > clip.end) t = start;
  if (duration && duration > 0 && t > duration - 0.1) t = Math.max(0, duration - 0.1);
  return t;
}

/**
 * Saves a JPEG cover frame of a (local or hosted) video and returns its local
 * file uri, or null if the frame couldn't be made (never throws).
 */
export async function makeVideoCover(videoUri: string, opts: { maxWidth?: number; timeoutMs?: number } = {}): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const { src } = parseClip(videoUri);
  if (!src) return null;
  let player: ReturnType<typeof createVideoPlayer> | null = null;
  const work = (async () => {
    player = createVideoPlayer(src);
    player.muted = true;
    const [thumb] = await player.generateThumbnailsAsync(coverTime(videoUri), { maxWidth: opts.maxWidth ?? 720 });
    if (!thumb) return null;
    const ref = await ImageManipulator.manipulate(thumb).renderAsync();
    const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });
    return saved?.uri || null;
  })();
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), opts.timeoutMs ?? 8000));
  try {
    return await Promise.race([work, timeout]);
  } catch {
    return null;
  } finally {
    // Release once the work settles (it may still be running after a timeout).
    work.finally(() => { try { (player as any)?.release?.(); } catch {} }).catch(() => {});
  }
}
