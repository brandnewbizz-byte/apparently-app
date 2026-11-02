/**
 * Video trim + fit, stored on the video's link as a media fragment:
 *   https://…/clip.mp4#t=3.2,14.8&fit=contain
 * The part after "#" is never sent to the server, so the file plays the same
 * everywhere; the app's player (components/AppVideo) reads it and plays only
 * the trimmed part, filled or fitted as chosen. No database change needed.
 */
export type VideoFit = 'cover' | 'contain';

export interface VideoClip {
  /** Seconds. */
  start?: number;
  /** Seconds. */
  end?: number;
  fit?: VideoFit;
}

export function parseClip(uri?: string | null): { src: string | null; clip: VideoClip } {
  if (!uri) return { src: null, clip: {} };
  const hash = uri.indexOf('#');
  if (hash < 0) return { src: uri, clip: {} };
  const src = uri.slice(0, hash);
  const clip: VideoClip = {};
  for (const part of uri.slice(hash + 1).split('&')) {
    const [k, v = ''] = part.split('=');
    if (k === 't') {
      const [a, b] = v.split(',');
      const s = parseFloat(a);
      const e = parseFloat(b);
      if (Number.isFinite(s) && s > 0) clip.start = s;
      if (Number.isFinite(e) && e > 0) clip.end = e;
    } else if (k === 'fit' && (v === 'contain' || v === 'cover')) {
      clip.fit = v;
    }
  }
  return { src, clip };
}

export function withClip(uri: string, clip?: VideoClip | null): string {
  const { src } = parseClip(uri);
  if (!src || !clip) return src || uri;
  const parts: string[] = [];
  const s = clip.start && clip.start > 0 ? Math.round(clip.start * 10) / 10 : 0;
  const e = clip.end && clip.end > 0 ? Math.round(clip.end * 10) / 10 : 0;
  if (s || e) parts.push(`t=${s}${e ? `,${e}` : ''}`);
  if (clip.fit === 'contain') parts.push('fit=contain');
  return parts.length ? `${src}#${parts.join('&')}` : src;
}

export const fmtSecs = (secs: number) => {
  const t = Math.max(0, Math.round(secs));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
