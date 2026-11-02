/**
 * Call sounds, made in code (no sound files to ship):
 *  - ringback: what the caller hears while the other phone rings
 *  - ringtone: what the person being called hears
 * Each is a short WAV written to the cache once, then played on a loop.
 */
import { Platform, Vibration } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

const RATE = 8000;
type Seg = [freqs: number[], seconds: number];

function wav(segments: Seg[], amp: number): Uint8Array {
  const total = segments.reduce((n, [, d]) => n + Math.round(d * RATE), 0);
  const buf = new ArrayBuffer(44 + total * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + total * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, total * 2, true);
  let o = 44;
  for (const [freqs, secs] of segments) {
    const n = Math.round(secs * RATE);
    const fade = RATE * 0.01;
    for (let i = 0; i < n; i++) {
      let s = 0;
      if (freqs.length) {
        const env = Math.min(1, i / fade, (n - i) / fade);
        for (const f of freqs) s += Math.sin((2 * Math.PI * f * i) / RATE);
        s = (s / freqs.length) * amp * env;
      }
      v.setInt16(o, Math.round(s * 32767), true);
      o += 2;
    }
  }
  return new Uint8Array(buf);
}

const RINGBACK: Seg[] = [[[440, 480], 2], [[], 4]]; // US ringback: 2 s on, 4 s off
const RINGTONE: Seg[] = (() => {
  const s: Seg[] = [];
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 10; i++) { s.push([[1046.5, 1318.5], 0.05]); s.push([[1318.5, 1568], 0.05]); }
    s.push([[], 0.25]);
  }
  s.push([[], 1.5]);
  return s;
})();

const cache: Record<string, string> = {};

async function toneUri(name: 'ringback' | 'ringtone'): Promise<string> {
  if (cache[name]) return cache[name];
  const bytes = name === 'ringback' ? wav(RINGBACK, 0.35) : wav(RINGTONE, 0.5);
  if (Platform.OS === 'web') {
    cache[name] = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/wav' }));
    return cache[name];
  }
  const { File, Paths } = await import('expo-file-system');
  const file = new File(Paths.cache, `apparently-${name}.wav`);
  if (!file.exists) {
    file.create({ overwrite: true });
    await file.write(bytes);
  }
  cache[name] = file.uri;
  return cache[name];
}

let player: AudioPlayer | null = null;
let playing: string | null = null;

/** Start a looping call sound (stops any other one). Never throws. */
export async function playTone(name: 'ringback' | 'ringtone'): Promise<void> {
  if (playing === name) return;
  stopTone();
  playing = name;
  try {
    if (Platform.OS !== 'web') {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, shouldRouteThroughEarpiece: false });
    }
    const uri = await toneUri(name);
    if (playing !== name) return; // stopped while loading
    const p = createAudioPlayer({ uri });
    p.loop = true;
    p.volume = 1;
    p.play();
    player = p;
    if (name === 'ringtone' && Platform.OS !== 'web') Vibration.vibrate([0, 600, 400, 600, 1400], true);
  } catch (e) {
    console.log('[CallTones] play failed:', e);
  }
}

export function stopTone(): void {
  playing = null;
  try { player?.pause(); player?.remove(); } catch {}
  player = null;
  if (Platform.OS !== 'web') Vibration.cancel();
}
