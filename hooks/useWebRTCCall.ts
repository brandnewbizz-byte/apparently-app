/**
 * useWebRTCCall — 1:1 WebRTC voice calling hook
 *
 * Signaling now runs over Supabase Realtime Broadcast instead of a custom
 * WebSocket server. The signaling server was just a thin JSON relay
 * (join/leave, offer/answer, ICE candidates) — Supabase Realtime Broadcast
 * already powers text chat + presence in this app, so it can carry the same
 * signaling messages with no additional backend to deploy.
 *
 *  - Outgoing calls: send offer, handle answer, ICE exchange
 *  - Incoming calls: listen for offers, send answer
 *  - Mute/unmute local audio
 *  - Speakerphone toggle
 *  - Call duration tracking
 *  - End call cleanup
 *
 * NOTE: The actual WebRTC media (RTCPeerConnection / getUserMedia) is a
 * browser API. On web it works natively. On native it requires the
 * `react-native-webrtc` native module — which is NOT currently installed.
 * This hook degrades gracefully (surfaces `callError`) instead of crashing
 * when WebRTC is unavailable.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAudio as Audio } from '@/lib/safe-av';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type CallState = 'idle' | 'calling' | 'ringing' | 'connecting' | 'active' | 'ended';

export interface CallConfig {
  roomId: string;
  peerId: string;
  peerName: string;
  targetPeerId: string;
  targetPeerName: string;
}

const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

// WebRTC media availability guard (web vs native).
function webRtcMediaAvailable(): boolean {
  return (
    typeof RTCPeerConnection !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

export function useWebRTCCall() {
  const [callState, setCallState] = useState<CallState>('idle');
  const [callError, setCallError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const configRef = useRef<CallConfig | null>(null);

  // ── Timer ──
  const startTimer = useCallback(() => {
    clearInterval(timerRef.current!);
    const start = Date.now();
    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - start) / 1000));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setDuration(0);
  }, []);

  const sendSignal = useCallback((event: string, payload: Record<string, unknown>) => {
    channelRef.current?.send({ type: 'broadcast', event, payload }).then(() => {}, () => {});
  }, []);

  // ── WebRTC Setup ──
  const createPeerConnection = useCallback(async (config: CallConfig): Promise<RTCPeerConnection> => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate && configRef.current) {
        sendSignal('ice_candidate', {
          roomId: configRef.current.roomId,
          peerId: configRef.current.peerId,
          targetPeerId: configRef.current.targetPeerId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      // Remote audio stream — play through speaker.
      // In React Native there is no browser <audio> element to construct;
      // the RTCPeerConnection already emits/consumes the decoded stream natively.
      Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallState('active');
        startTimer();
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setCallState('ended');
        stopTimer();
      }
    };

    // Get local audio
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    } catch (e) {
      console.log('[WebRTC] getUserMedia failed:', e);
      // Continue without local audio — still try the call
    }

    pcRef.current = pc;
    return pc;
  }, [sendSignal, startTimer, stopTimer]);

  // ── Signaling (Supabase Realtime) ──
  const connectSignaling = useCallback((config: CallConfig): Promise<void> => {
    return new Promise((resolve, reject) => {
      configRef.current = config;

      const ch = supabase.channel(`call:${config.roomId}`, {
        config: { broadcast: { self: false } },
      });

      ch.on('broadcast', { event: 'offer' }, async ({ payload }: any) => {
        const cfg = configRef.current;
        if (!cfg) return;
        // Only react if this offer is addressed to us (or unaddressed in a 1:1)
        if (payload?.targetPeerId && payload.targetPeerId !== cfg.peerId) return;

        setCallState('ringing');
        const pc = pcRef.current || await createPeerConnection(cfg);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal('answer', {
          roomId: cfg.roomId,
          peerId: cfg.peerId,
          targetPeerId: payload.peerId || '',
          sdp: answer,
        });
        setCallState('connecting');
      });

      ch.on('broadcast', { event: 'answer' }, async ({ payload }: any) => {
        const cfg = configRef.current;
        if (!cfg) return;
        if (payload?.targetPeerId && payload.targetPeerId !== cfg.peerId) return;
        if (!pcRef.current) return;
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        setCallState('connecting');
      });

      ch.on('broadcast', { event: 'ice_candidate' }, async ({ payload }: any) => {
        const cfg = configRef.current;
        if (!cfg) return;
        if (payload?.targetPeerId && payload.targetPeerId !== cfg.peerId) return;
        if (!pcRef.current || !payload.candidate) return;
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (e) {
          console.log('[WebRTC] ICE candidate failed:', e);
        }
      });

      ch.on('broadcast', { event: 'call_ended' }, ({ payload }: any) => {
        const cfg = configRef.current;
        if (!cfg) return;
        if (payload?.targetPeerId && payload.targetPeerId !== cfg.peerId) return;
        setCallState('ended');
        stopTimer();
      });

      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(new Error(`Signaling channel failed: ${status}`));
        }
      });

      channelRef.current = ch;

      // Timeout
      setTimeout(() => {
        // (no-op timeout — subscribe resolves/rejects on its own)
      }, 10000);
    });
  }, [createPeerConnection, sendSignal, stopTimer]);

  // ── Start Call (outgoing) ──
  const startCall = useCallback(async (config: CallConfig) => {
    setCallState('calling');
    setCallError(null);
    configRef.current = config;
    stopTimer();

    if (!webRtcMediaAvailable()) {
      setCallError('Voice calls are not available on this device (WebRTC media support is missing).');
      setCallState('ended');
      return;
    }

    try {
      await connectSignaling(config);

      const pc = await createPeerConnection(config);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal('offer', {
        roomId: config.roomId,
        peerId: config.peerId,
        targetPeerId: config.targetPeerId,
        sdp: offer,
      });

      setCallState('ringing');
    } catch (e: any) {
      console.log('[WebRTC] Start call failed:', e?.message || e);
      setCallError('Call failed to start.');
      setCallState('ended');
    }
  }, [connectSignaling, createPeerConnection, sendSignal, stopTimer]);

  // ── Accept incoming call ──
  const acceptCall = useCallback(async (config: CallConfig) => {
    configRef.current = config;
    setCallError(null);
    setCallState('connecting');

    if (!webRtcMediaAvailable()) {
      setCallError('Voice calls are not available on this device (WebRTC media support is missing).');
      setCallState('ended');
      return;
    }

    try {
      await connectSignaling(config);
      // The offer handler in ch.on('broadcast') will create the PC and send answer
    } catch (e: any) {
      console.log('[WebRTC] Accept call failed:', e?.message || e);
      setCallError('Call failed to connect.');
      setCallState('ended');
    }
  }, [connectSignaling]);

  // ── Toggle Mute ──
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  // ── Toggle Speaker ──
  const toggleSpeaker = useCallback(async () => {
    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: isSpeakerOn,
        });
        setIsSpeakerOn(!isSpeakerOn);
      }
    } catch (e) {
      console.log('[WebRTC] Speaker toggle failed:', e);
    }
  }, [isSpeakerOn]);

  // ── End Call ──
  const endCall = useCallback(() => {
    setCallState('ended');
    stopTimer();

    // Close peer connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }

    // Signal + leave channel
    const cfg = configRef.current;
    if (cfg && channelRef.current) {
      sendSignal('call_ended', {
        roomId: cfg.roomId,
        peerId: cfg.peerId,
        targetPeerId: cfg.targetPeerId,
      });
      supabase.removeChannel(channelRef.current).then(() => {}, () => {});
      channelRef.current = null;
    }

    configRef.current = null;
  }, [sendSignal, stopTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);

  return {
    callState,
    callError,
    duration,
    isMuted,
    isSpeakerOn,
    startCall,
    acceptCall,
    endCall,
    toggleMute,
    toggleSpeaker,
  };
}
