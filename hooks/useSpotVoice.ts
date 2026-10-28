import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  AudioQuality, IOSOutputFormat, createAudioPlayer, requestRecordingPermissionsAsync,
  setAudioModeAsync, useAudioRecorder,
} from 'expo-audio';
import type { AudioPlayer, RecordingOptions } from 'expo-audio';
import { logger } from '@/lib/logger';

/**
 * Hold-to-talk for Spot rooms.
 *
 * While you hold the mic we record short AAC clips (~1.2s) and send each one
 * over the room's live channel the moment it's done, so everyone hears you
 * almost as you speak. Each listener queues the clips per speaker and plays
 * them back to back.
 */

const OPTIONS: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: { outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.LOW },
  web: { mimeType: 'audio/webm', bitsPerSecond: 32000 },
};

const CLIP_MS = 1200;
const MAX_TALK_MS = 60_000;

interface Room {
  send: (event: string, payload: any) => void;
  on: (event: string, fn: (payload: any) => void) => () => void;
}
interface Me { id: string; name: string }

async function readBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] || '');
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }
  const { File } = await import('expo-file-system');
  return new File(uri).base64();
}

let clipCounter = 0;
async function clipSource(uid: string, b64: string, mime: string): Promise<string> {
  if (Platform.OS === 'web') return `data:${mime};base64,${b64}`;
  const { File, Directory, Paths } = await import('expo-file-system');
  const dir = new Directory(Paths.cache, 'spot-voice');
  if (!dir.exists) dir.create({ intermediates: true });
  clipCounter = (clipCounter + 1) % 40;
  const file = new File(dir, `${uid.slice(0, 8)}-${clipCounter}.m4a`);
  if (file.exists) file.delete();
  file.create({ overwrite: true });
  file.write(b64, { encoding: 'base64' });
  return file.uri;
}

export function useSpotVoice(room: Room, me: Me | null) {
  const recorder = useAudioRecorder(OPTIONS);
  const [talking, setTalking] = useState(false);
  /** uid → last time we heard them */
  const [speaking, setSpeaking] = useState<Record<string, number>>({});
  const holding = useRef(false);
  const startedAt = useRef(0);
  const seq = useRef(0);

  // ── Listening ──────────────────────────────────────────────────────────
  const queues = useRef<Record<string, { clips: string[]; playing: AudioPlayer | null; timer: ReturnType<typeof setTimeout> | null }>>({});

  const markSpeaking = useCallback((uid: string, on: boolean) => {
    setSpeaking((prev) => {
      if (!on) { if (!prev[uid]) return prev; const n = { ...prev }; delete n[uid]; return n; }
      return { ...prev, [uid]: Date.now() };
    });
  }, []);

  const playNext = useCallback((uid: string) => {
    const q = queues.current[uid];
    if (!q || q.playing) return;
    const src = q.clips.shift();
    if (!src) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (q.timer) { clearTimeout(q.timer); q.timer = null; }
      try { q.playing?.remove(); } catch {}
      q.playing = null;
      playNext(uid);
    };
    try {
      const p = createAudioPlayer(src);
      q.playing = p;
      p.volume = 1;
      p.addListener('playbackStatusUpdate', (st: any) => { if (st?.didJustFinish) finish(); });
      p.play();
      // Never let one bad clip block the queue.
      q.timer = setTimeout(finish, CLIP_MS + 1500);
    } catch (e: any) {
      logger.warn('SpotVoice', 'playback failed', { error: e?.message });
      finish();
    }
  }, []);

  useEffect(() => {
    if (!me) return;
    const offVoice = room.on('voice', async (p) => {
      if (!p?.uid || p.uid === me.id || !p.b64) return;
      markSpeaking(p.uid, true);
      try {
        const src = await clipSource(p.uid, p.b64, p.mime || 'audio/mp4');
        const q = (queues.current[p.uid] ||= { clips: [], playing: null, timer: null });
        // If we fall far behind, drop the oldest clips so it stays "live".
        if (q.clips.length > 4) q.clips.splice(0, q.clips.length - 2);
        q.clips.push(src);
        playNext(p.uid);
      } catch (e: any) {
        logger.warn('SpotVoice', 'clip failed', { error: e?.message });
      }
    });
    const offTalk = room.on('talk', (p) => { if (p?.uid && p.uid !== me.id) markSpeaking(p.uid, !!p.on); });
    // Clear anyone we haven't heard for a few seconds.
    const sweep = setInterval(() => {
      setSpeaking((prev) => {
        const now = Date.now();
        const stale = Object.entries(prev).filter(([, t]) => now - t > 4000);
        if (!stale.length) return prev;
        const n = { ...prev };
        stale.forEach(([k]) => delete n[k]);
        return n;
      });
    }, 1500);
    return () => {
      offVoice(); offTalk(); clearInterval(sweep);
      Object.values(queues.current).forEach((q) => {
        if (q.timer) clearTimeout(q.timer);
        try { q.playing?.remove(); } catch {}
      });
      queues.current = {};
    };
  }, [room, me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Talking ────────────────────────────────────────────────────────────
  const recordClip = useCallback(async () => {
    await recorder.prepareToRecordAsync();
    recorder.record();
    const began = Date.now();
    // Wait until the clip is long enough or the mic was released.
    await new Promise<void>((resolve) => {
      const tick = setInterval(() => {
        if (!holding.current || Date.now() - began >= CLIP_MS) { clearInterval(tick); resolve(); }
      }, 50);
    });
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri || Date.now() - began < 250) return;
    const b64 = await readBase64(uri);
    if (b64 && me) {
      room.send('voice', {
        uid: me.id, name: me.name, seq: seq.current++, b64,
        mime: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4',
      });
    }
  }, [recorder, room, me]);

  const startTalking = useCallback(async (): Promise<'ok' | 'denied' | 'failed'> => {
    if (holding.current || !me) return 'failed';
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) return 'denied';
      holding.current = true;
      startedAt.current = Date.now();
      setTalking(true);
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldRouteThroughEarpiece: false });
      room.send('talk', { uid: me.id, on: true });
      // Loop clips while the mic is held.
      (async () => {
        try {
          while (holding.current && Date.now() - startedAt.current < MAX_TALK_MS) {
            await recordClip();
          }
        } catch (e: any) {
          logger.warn('SpotVoice', 'record failed', { error: e?.message });
        } finally {
          holding.current = false;
          setTalking(false);
          room.send('talk', { uid: me.id, on: false });
          setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldRouteThroughEarpiece: false }).catch(() => {});
        }
      })();
      return 'ok';
    } catch (e: any) {
      logger.warn('SpotVoice', 'start failed', { error: e?.message });
      holding.current = false;
      setTalking(false);
      return 'failed';
    }
  }, [me, room, recordClip]);

  const stopTalking = useCallback(() => { holding.current = false; }, []);

  // Let go of the mic if we leave the room mid-sentence.
  useEffect(() => () => { holding.current = false; }, []);

  return { talking, speaking, startTalking, stopTalking };
}
