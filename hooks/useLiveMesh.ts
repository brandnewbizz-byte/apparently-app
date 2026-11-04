/**
 * useLiveMesh — real-time live audio (and video) for feed posts and Spot rooms.
 *
 * The old way recorded 1.2 s audio files, sent them as text over the live
 * channel and played them back one by one. That's why live voice was slow and
 * choppy, and why the feed froze: the phone kept stopping and restarting the
 * recorder and writing files while the post's video was playing.
 *
 * This uses WebRTC instead (the same engine as calls): sound and video stream
 * continuously with ~0.2 s delay. Each person who is live sends one stream to
 * each person watching ("mesh"). Signalling goes over the room's existing
 * Supabase broadcast channel, as `rtc` messages.
 *
 *   viewer joins            → { t: 'hello' }                    (everyone)
 *   someone goes live       → { t: 'pub' }                      (everyone)
 *   viewer wants that stream→ { t: 'want', to: pub }
 *   live person → viewer    → { t: 'offer', to, sdp }
 *   viewer → live person    → { t: 'answer', to, sdp }
 *   both ways               → { t: 'ice', to, side, c }
 *   live person stops       → { t: 'unpub' }
 *   viewer leaves           → { t: 'bye' }
 *
 * Nothing connects until someone actually goes live, so scrolling the feed
 * costs nothing. Phones without the WebRTC module report `available: false`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { setAudioModeAsync } from 'expo-audio';
import { getWebRTC } from '@/lib/webrtc';

export interface MeshRoom {
  send: (event: string, payload: any) => void;
  on: (event: string, fn: (payload: any) => void) => () => void;
}

export interface MeshRemote {
  uid: string;
  name: string;
  stream: any;
  video: boolean;
}

const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
];
/** Live posts and rooms are voice-first: small, smooth video. */
const VIDEO = { facingMode: 'user', width: 480, height: 480, frameRate: 24 };

const plain = (x: any) => (x && typeof x.toJSON === 'function' ? x.toJSON() : x);

interface Peer { pc: any; queue: any[] }

export function useLiveMesh(room: MeshRoom, me: { id: string; name: string } | null, opts?: { enabled?: boolean; soundOn?: boolean; ready?: boolean }) {
  const enabled = opts?.enabled !== false && !!me;
  const ready = opts?.ready !== false;
  const soundOn = opts?.soundOn !== false;
  const available = !!getWebRTC();

  const [publishing, setPublishing] = useState(false);
  const [localStream, setLocalStream] = useState<any | null>(null);
  const [remotes, setRemotes] = useState<Record<string, MeshRemote>>({});

  const outPeers = useRef<Record<string, Peer>>({}); // me → viewer
  const inPeers = useRef<Record<string, Peer>>({});  // live person → me
  const local = useRef<any | null>(null);
  const pubVideo = useRef(false);
  const meRef = useRef(me);
  meRef.current = me;
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

  const send = useCallback((msg: Record<string, any>) => {
    const m = meRef.current;
    if (!m) return;
    room.send('rtc', { ...msg, from: m.id, name: m.name });
  }, [room]);

  // ── Audio session: speaker on, recording allowed while anything is connected ──
  const audioOn = useRef(false);
  const syncAudio = useCallback(() => {
    if (Platform.OS === 'web') return;
    const want = !!local.current || Object.keys(inPeers.current).length > 0;
    if (want === audioOn.current) return;
    audioOn.current = want;
    setAudioModeAsync({ allowsRecording: want, playsInSilentMode: true, shouldRouteThroughEarpiece: false }).catch(() => {});
  }, []);

  const closePeer = useCallback((map: Record<string, Peer>, uid: string) => {
    const p = map[uid];
    if (!p) return;
    delete map[uid];
    try { p.pc.close(); } catch {}
  }, []);

  const dropRemote = useCallback((uid: string) => {
    closePeer(inPeers.current, uid);
    setRemotes((prev) => { if (!prev[uid]) return prev; const n = { ...prev }; delete n[uid]; return n; });
    syncAudio();
  }, [closePeer, syncAudio]);

  const newPc = useCallback((uid: string, side: 'pub' | 'sub', map: Record<string, Peer>) => {
    const rtc = getWebRTC()!;
    const pc = new rtc.RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peer: Peer = { pc, queue: [] };
    map[uid] = peer;
    pc.addEventListener('icecandidate', (e: any) => {
      if (e.candidate) send({ t: 'ice', to: uid, side, c: plain(e.candidate) });
    });
    pc.addEventListener('connectionstatechange', () => {
      const st = pc.connectionState;
      if (st === 'failed' || st === 'closed') {
        if (map[uid]?.pc !== pc) return;
        if (side === 'sub') dropRemote(uid);
        else closePeer(map, uid);
      }
    });
    return peer;
  }, [send, dropRemote, closePeer]);

  const flush = async (peer: Peer) => {
    const rtc = getWebRTC();
    if (!rtc) return;
    const list = peer.queue.splice(0);
    for (const c of list) { try { await peer.pc.addIceCandidate(new rtc.RTCIceCandidate(c)); } catch {} }
  };

  /** Live person: send my stream to one viewer. */
  const offerTo = useCallback(async (uid: string) => {
    const stream = local.current;
    if (!stream || !getWebRTC() || uid === meRef.current?.id) return;
    const existing = outPeers.current[uid];
    if (existing && ['new', 'connecting', 'connected'].includes(existing.pc.connectionState)) return;
    closePeer(outPeers.current, uid);
    const peer = newPc(uid, 'pub', outPeers.current);
    try {
      stream.getTracks().forEach((t: any) => peer.pc.addTrack(t, stream));
      const offer = await peer.pc.createOffer({});
      await peer.pc.setLocalDescription(offer);
      const d = peer.pc.localDescription;
      send({ t: 'offer', to: uid, sdp: { type: d.type, sdp: d.sdp }, video: pubVideo.current });
    } catch {
      closePeer(outPeers.current, uid);
    }
  }, [closePeer, newPc, send]);

  /** Viewer: answer a live person's offer. */
  const answerOffer = useCallback(async (from: string, name: string, sdp: any, video: boolean) => {
    const rtc = getWebRTC();
    if (!rtc) return;
    closePeer(inPeers.current, from);
    const peer = newPc(from, 'sub', inPeers.current);
    peer.pc.addEventListener('track', (e: any) => {
      const s = e.streams && e.streams[0];
      if (!s) return;
      try { s.getAudioTracks().forEach((t: any) => { t.enabled = soundRef.current; }); } catch {}
      setRemotes((prev) => ({ ...prev, [from]: { uid: from, name: name || 'Someone', stream: s, video: video || (s.getVideoTracks?.().length ?? 0) > 0 } }));
    });
    syncAudio();
    try {
      await peer.pc.setRemoteDescription(new rtc.RTCSessionDescription(sdp));
      await flush(peer);
      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      const d = peer.pc.localDescription;
      send({ t: 'answer', to: from, sdp: { type: d.type, sdp: d.sdp } });
    } catch {
      dropRemote(from);
    }
  }, [closePeer, newPc, send, syncAudio, dropRemote]);

  // ── Signalling ──
  useEffect(() => {
    if (!enabled || !available || !me) return;
    const off = room.on('rtc', async (m: any) => {
      const myId = meRef.current?.id;
      if (!m?.from || m.from === myId) return;
      if (m.to && m.to !== myId) return;
      const rtc = getWebRTC();
      switch (m.t) {
        case 'hello':
        case 'want':
          if (local.current) offerTo(m.from);
          break;
        case 'pub':
          send({ t: 'want', to: m.from });
          break;
        case 'offer':
          if (m.sdp) answerOffer(m.from, m.name, m.sdp, !!m.video);
          break;
        case 'answer': {
          const p = outPeers.current[m.from];
          if (!p || !rtc || !m.sdp || p.pc.remoteDescription) break;
          try { await p.pc.setRemoteDescription(new rtc.RTCSessionDescription(m.sdp)); await flush(p); } catch {}
          break;
        }
        case 'ice': {
          // A candidate from a live person belongs to my incoming connection, and the other way round.
          const p = m.side === 'pub' ? inPeers.current[m.from] : outPeers.current[m.from];
          if (!p || !rtc || !m.c) break;
          if (!p.pc.remoteDescription) { p.queue.push(m.c); break; }
          try { await p.pc.addIceCandidate(new rtc.RTCIceCandidate(m.c)); } catch {}
          break;
        }
        case 'unpub':
          dropRemote(m.from);
          break;
        case 'bye':
          closePeer(outPeers.current, m.from);
          dropRemote(m.from);
          break;
      }
    });
    return () => {
      off();
      send({ t: 'bye' });
    };
  }, [enabled, available, me?.id, room]); // eslint-disable-line react-hooks/exhaustive-deps

  // Once the channel is connected, ask anyone already live to send their stream.
  useEffect(() => {
    if (!enabled || !available || !ready) return;
    send({ t: 'hello' });
    if (local.current) send({ t: 'pub', video: pubVideo.current });
  }, [enabled, available, ready, send]);

  // Listener speaker switch: mute / unmute every incoming voice instantly.
  useEffect(() => {
    Object.values(remotes).forEach((r) => {
      try { r.stream.getAudioTracks().forEach((t: any) => { t.enabled = soundOn; }); } catch {}
    });
  }, [soundOn, remotes]);

  const stopLocal = useCallback(() => {
    Object.keys(outPeers.current).forEach((uid) => closePeer(outPeers.current, uid));
    const s = local.current;
    local.current = null;
    if (s) {
      try { s.getTracks().forEach((t: any) => t.stop()); } catch {}
      try { s.release?.(); } catch {}
    }
    setLocalStream(null);
    setPublishing(false);
    syncAudio();
  }, [closePeer, syncAudio]);

  const unpublish = useCallback(() => {
    if (!local.current) return;
    send({ t: 'unpub' });
    stopLocal();
  }, [send, stopLocal]);

  /** Go live with the mic (and camera). Restarts the stream if the camera choice changed. */
  const publish = useCallback(async (o: { video?: boolean } = {}): Promise<'ok' | 'denied' | 'failed'> => {
    const rtc = getWebRTC();
    if (!rtc || !meRef.current) return 'failed';
    const video = !!o.video;
    if (local.current && pubVideo.current === video) return 'ok';
    if (local.current) { send({ t: 'unpub' }); stopLocal(); }
    let stream: any;
    try {
      stream = await rtc.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } as any,
        video: video ? VIDEO : false,
      });
    } catch {
      return 'denied';
    }
    local.current = stream;
    pubVideo.current = video;
    setLocalStream(stream);
    setPublishing(true);
    syncAudio();
    send({ t: 'pub', video });
    return 'ok';
  }, [send, stopLocal, syncAudio]);

  const setMic = useCallback((on: boolean) => {
    try { local.current?.getAudioTracks().forEach((t: any) => { t.enabled = on; }); } catch {}
  }, []);

  const switchCamera = useCallback(() => {
    const track: any = local.current?.getVideoTracks?.()[0];
    try { if (track && typeof track._switchCamera === 'function') track._switchCamera(); } catch {}
  }, []);

  // Leaving the app or the screen ends everything.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') unpublish(); });
    return () => sub.remove();
  }, [unpublish]);
  useEffect(() => () => {
    stopLocal();
    Object.keys(inPeers.current).forEach((uid) => closePeer(inPeers.current, uid));
    if (audioOn.current && Platform.OS !== 'web') {
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldRouteThroughEarpiece: false }).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const remoteList = useMemo(() => Object.values(remotes), [remotes]);
  return { available, publishing, localStream, remotes: remoteList, publish, unpublish, setMic, switchCamera };
}
