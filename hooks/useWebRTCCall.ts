/**
 * useWebRTCCall — 1:1 voice and video calls.
 *
 * Media: WebRTC (browser on web, react-native-webrtc on phones — see lib/webrtc).
 * Signalling: Supabase Realtime broadcast on the channel `call:<roomId>`.
 *
 * Handshake (so nothing is lost while the other phone is still ringing):
 *   1. Caller joins the channel, opens mic/camera and waits.
 *   2. The person being called taps Answer, joins and sends `join`
 *      (repeated every few seconds until the offer arrives).
 *   3. Caller sends the `offer`, callee replies with the `answer`,
 *      both trade ICE candidates (queued until the remote description is set).
 * Either side can send `call_ended`; the callee can send `call_declined`.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { setAudioModeAsync } from 'expo-audio';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getWebRTC } from '@/lib/webrtc';
import { CALL_RING_MS } from '@/lib/calls';
import { ICE_SERVERS } from '@/lib/ice';
import { callAudioAvailable, callConnected, callEnd, callSpeaker, callStart } from '@/lib/callAudio';

export type CallState = 'idle' | 'calling' | 'ringing' | 'connecting' | 'active' | 'ended';

export interface CallConfig {
  roomId: string;
  peerId: string;
  peerName: string;
  targetPeerId: string;
  targetPeerName: string;
  video?: boolean;
  /** Answered on the iPhone's own call screen (CallKit handles the audio session). */
  systemCall?: boolean;
}

const JOIN_WAIT_MS = 25_000; // callee gives up if the caller never sends an offer
const JOIN_REPEAT_MS = 3_000;
const CANT_CONNECT = 'The call couldn’t connect. Check your internet connection and try again.';
const CANT_REACH = 'Couldn’t reach the call service. Check your connection and try again.';

const plain = (x: any) => (x && typeof x.toJSON === 'function' ? x.toJSON() : x);

export function useWebRTCCall() {
  const [callState, setCallState] = useState<CallState>('idle');
  const [callError, setCallError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [localStream, setLocalStream] = useState<any | null>(null);
  const [remoteStream, setRemoteStream] = useState<any | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const pcRef = useRef<any | null>(null);
  const localRef = useRef<any | null>(null);
  const configRef = useRef<CallConfig | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingIce = useRef<any[]>([]);
  const activeRef = useRef(false);
  const endedRef = useRef(false);
  const frontCamRef = useRef(true);

  const clearWaits = useCallback(() => {
    if (waitRef.current) clearTimeout(waitRef.current);
    if (joinRef.current) clearInterval(joinRef.current);
    waitRef.current = null;
    joinRef.current = null;
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  /** Phones: route call audio to the loudspeaker or the earpiece. */
  const applySpeaker = useCallback(async (on: boolean) => {
    if (Platform.OS === 'web') return;
    if (callAudioAvailable()) { callSpeaker(on); return; }
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: !on,
      });
    } catch (e) {
      console.log('[Call] speaker route failed:', e);
    }
  }, []);

  const sendSignal = useCallback((event: string, extra: Record<string, unknown> = {}) => {
    const cfg = configRef.current;
    const ch = channelRef.current;
    if (!cfg || !ch) return Promise.resolve();
    return ch
      .send({ type: 'broadcast', event, payload: { roomId: cfg.roomId, peerId: cfg.peerId, targetPeerId: cfg.targetPeerId, ...extra } })
      .then(() => {}, () => {});
  }, []);

  /** Tear everything down locally and show the "Call ended" screen. */
  const finish = useCallback((error?: string) => {
    if (endedRef.current) return;
    endedRef.current = true;
    clearWaits();
    stopTimer();
    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;
    try { localRef.current?.getTracks().forEach((t: any) => t.stop()); } catch {}
    try { localRef.current?.release?.(); } catch {}
    localRef.current = null;
    pendingIce.current = [];
    const ch = channelRef.current;
    channelRef.current = null;
    if (ch) supabase.removeChannel(ch).then(() => {}, () => {});
    setLocalStream(null);
    setRemoteStream(null);
    if (error) setCallError(error);
    setCallState('ended');
    if (callAudioAvailable()) callEnd();
    else if (Platform.OS !== 'web') {
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldRouteThroughEarpiece: false }).catch(() => {});
    }
  }, [clearWaits, stopTimer]);

  const markActive = useCallback(() => {
    if (activeRef.current || endedRef.current) return;
    activeRef.current = true;
    clearWaits();
    setCallState('active');
    const start = Date.now();
    setDuration(0);
    timerRef.current = setInterval(() => setDuration(Math.floor((Date.now() - start) / 1000)), 1000);
    // Video calls start on the loudspeaker, voice calls on the earpiece.
    const speaker = !!configRef.current?.video;
    setIsSpeakerOn(speaker);
    if (callAudioAvailable()) callConnected(speaker);
    else applySpeaker(speaker);
  }, [applySpeaker, clearWaits]);

  const addRemoteIce = useCallback(async (candidate: any) => {
    const rtc = getWebRTC();
    const pc = pcRef.current;
    if (!rtc || !candidate) return;
    if (!pc || !pc.remoteDescription) {
      pendingIce.current.push(candidate);
      return;
    }
    try {
      await pc.addIceCandidate(new rtc.RTCIceCandidate(candidate));
    } catch (e) {
      console.log('[Call] ICE candidate failed:', e);
    }
  }, []);

  const flushIce = useCallback(async () => {
    const list = pendingIce.current.splice(0);
    for (const c of list) await addRemoteIce(c);
  }, [addRemoteIce]);

  /** Opens the mic (and camera for video calls) and creates the connection. */
  const createPeer = useCallback(async (cfg: CallConfig) => {
    const rtc = getWebRTC();
    if (!rtc) throw new Error('Calls need the latest version of Apparently. Update the app and try again.');

    let stream: any;
    try {
      stream = await rtc.mediaDevices.getUserMedia({
        audio: true,
        video: cfg.video ? { facingMode: 'user', width: 640, height: 480, frameRate: 24 } : false,
      });
    } catch {
      throw new Error(cfg.video
        ? 'Allow camera and microphone access for Apparently in Settings, then try again.'
        : 'Allow microphone access for Apparently in Settings, then try again.');
    }
    if (endedRef.current) {
      stream.getTracks().forEach((t: any) => t.stop());
      throw new Error('cancelled');
    }
    localRef.current = stream;
    setLocalStream(stream);

    const pc = new rtc.RTCPeerConnection({ iceServers: ICE_SERVERS });
    stream.getTracks().forEach((t: any) => pc.addTrack(t, stream));

    pc.addEventListener('icecandidate', (e: any) => {
      if (e.candidate) sendSignal('ice_candidate', { candidate: plain(e.candidate) });
    });
    pc.addEventListener('track', (e: any) => {
      const s = e.streams && e.streams[0];
      if (s) setRemoteStream(s);
    });
    pc.addEventListener('connectionstatechange', () => {
      const st = pc.connectionState;
      if (st === 'connected') markActive();
      else if (st === 'failed') finish(CANT_CONNECT);
    });
    pc.addEventListener('iceconnectionstatechange', () => {
      const st = pc.iceConnectionState;
      if (st === 'connected' || st === 'completed') markActive();
    });

    pcRef.current = pc;
    return pc;
  }, [finish, markActive, sendSignal]);

  /** Caller: send (or re-send) the offer once the other person has joined. */
  const sendOffer = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || pc.remoteDescription) return;
    if (!pc.localDescription) {
      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);
    }
    const d = pc.localDescription;
    await sendSignal('offer', { sdp: { type: d.type, sdp: d.sdp } });
  }, [sendSignal]);

  const connectSignaling = useCallback((cfg: CallConfig) => new Promise<void>((resolve, reject) => {
    const ch = supabase.channel(`call:${cfg.roomId}`, { config: { broadcast: { self: false } } });
    const forMe = (p: any) => !p?.targetPeerId || p.targetPeerId === configRef.current?.peerId;

    ch.on('broadcast', { event: 'join' }, async ({ payload }: any) => {
      if (!forMe(payload) || endedRef.current) return;
      if (waitRef.current) clearTimeout(waitRef.current);
      waitRef.current = null;
      setCallState((s) => (s === 'active' ? s : 'connecting'));
      try { await sendOffer(); } catch (e) { console.log('[Call] offer failed:', e); }
    });

    ch.on('broadcast', { event: 'offer' }, async ({ payload }: any) => {
      const rtc = getWebRTC();
      const pc = pcRef.current;
      if (!forMe(payload) || !rtc || !pc || pc.remoteDescription || !payload?.sdp) return;
      if (joinRef.current) clearInterval(joinRef.current);
      joinRef.current = null;
      try {
        await pc.setRemoteDescription(new rtc.RTCSessionDescription(payload.sdp));
        await flushIce();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        const d = pc.localDescription;
        await sendSignal('answer', { sdp: { type: d.type, sdp: d.sdp } });
      } catch (e) {
        console.log('[Call] answer failed:', e);
        finish(CANT_CONNECT);
      }
    });

    ch.on('broadcast', { event: 'answer' }, async ({ payload }: any) => {
      const rtc = getWebRTC();
      const pc = pcRef.current;
      if (!forMe(payload) || !rtc || !pc || pc.remoteDescription || !payload?.sdp) return;
      try {
        await pc.setRemoteDescription(new rtc.RTCSessionDescription(payload.sdp));
        await flushIce();
      } catch (e) {
        console.log('[Call] remote answer failed:', e);
      }
    });

    ch.on('broadcast', { event: 'ice_candidate' }, ({ payload }: any) => {
      if (forMe(payload)) addRemoteIce(payload?.candidate);
    });

    ch.on('broadcast', { event: 'call_ended' }, ({ payload }: any) => {
      if (forMe(payload)) finish();
    });

    ch.on('broadcast', { event: 'call_declined' }, ({ payload }: any) => {
      if (forMe(payload)) finish(`${configRef.current?.targetPeerName || 'They'} can’t talk right now.`);
    });

    const t = setTimeout(() => reject(new Error(CANT_REACH)), 10_000);
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(t);
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(t);
        reject(new Error(CANT_REACH));
      }
    });
    channelRef.current = ch;
  }), [addRemoteIce, finish, flushIce, sendOffer, sendSignal]);

  const reset = useCallback((cfg: CallConfig) => {
    configRef.current = cfg;
    endedRef.current = false;
    activeRef.current = false;
    pendingIce.current = [];
    frontCamRef.current = true;
    setCallError(null);
    setDuration(0);
    setIsMuted(false);
    setIsCameraOff(false);
  }, []);

  // ── Outgoing call ──
  const startCall = useCallback(async (cfg: CallConfig) => {
    reset(cfg);
    setCallState('calling');
    if (callAudioAvailable()) callStart({ video: !!cfg.video, outgoing: true });
    try {
      await connectSignaling(cfg);
      await createPeer(cfg);
    } catch (e: any) {
      if (e?.message !== 'cancelled') finish(e?.message || CANT_CONNECT);
      return;
    }
    waitRef.current = setTimeout(() => {
      sendSignal('call_ended');
      finish('No answer.');
    }, CALL_RING_MS);
  }, [connectSignaling, createPeer, finish, reset, sendSignal]);

  // ── Answer an incoming call ──
  const acceptCall = useCallback(async (cfg: CallConfig) => {
    reset(cfg);
    setCallState('connecting');
    if (callAudioAvailable()) callStart({ video: !!cfg.video, outgoing: false, systemCall: !!cfg.systemCall });
    try {
      await connectSignaling(cfg);
      await createPeer(cfg);
    } catch (e: any) {
      if (e?.message !== 'cancelled') finish(e?.message || CANT_CONNECT);
      return;
    }
    sendSignal('join');
    joinRef.current = setInterval(() => sendSignal('join'), JOIN_REPEAT_MS);
    waitRef.current = setTimeout(() => finish('The call has ended.'), JOIN_WAIT_MS);
  }, [connectSignaling, createPeer, finish, reset, sendSignal]);

  const toggleMute = useCallback(() => {
    const track = localRef.current?.getAudioTracks?.()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMuted(!track.enabled);
  }, []);

  const toggleCamera = useCallback(() => {
    const track = localRef.current?.getVideoTracks?.()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsCameraOff(!track.enabled);
  }, []);

  const switchCamera = useCallback(() => {
    const track: any = localRef.current?.getVideoTracks?.()[0];
    if (!track) return;
    frontCamRef.current = !frontCamRef.current;
    try {
      if (typeof track._switchCamera === 'function') track._switchCamera();
      else track.applyConstraints?.({ facingMode: frontCamRef.current ? 'user' : 'environment' });
    } catch (e) {
      console.log('[Call] switch camera failed:', e);
    }
  }, []);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn((on) => {
      applySpeaker(!on);
      return !on;
    });
  }, [applySpeaker]);

  // ── Hang up ──
  const endCall = useCallback(() => {
    if (endedRef.current) return;
    const ch = channelRef.current;
    const cfg = configRef.current;
    if (ch && cfg) {
      // Send "ended" first, then leave the channel.
      channelRef.current = null;
      ch.send({ type: 'broadcast', event: 'call_ended', payload: { roomId: cfg.roomId, peerId: cfg.peerId, targetPeerId: cfg.targetPeerId } })
        .then(() => {}, () => {})
        .finally(() => { supabase.removeChannel(ch).then(() => {}, () => {}); });
    }
    finish();
  }, [finish]);

  // Leaving the screen hangs up.
  useEffect(() => () => endCall(), [endCall]);

  return {
    callState,
    callError,
    duration,
    isMuted,
    isSpeakerOn,
    isCameraOff,
    localStream,
    remoteStream,
    startCall,
    acceptCall,
    endCall,
    toggleMute,
    toggleSpeaker,
    toggleCamera,
    switchCamera,
  };
}
