/**
 * useWebRTCCall — 1:1 WebRTC voice calling hook
 *
 * Connects to the signaling server at /ws/room and handles:
 *  - Outgoing calls: send offer, handle answer, ICE exchange
 *  - Incoming calls: listen for offers, send answer
 *  - Mute/unmute local audio
 *  - Speakerphone toggle
 *  - Call duration tracking
 *  - End call cleanup
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import { Audio } from 'expo-av';

export type CallState = 'idle' | 'calling' | 'ringing' | 'connecting' | 'active' | 'ended';

export interface CallConfig {
  serverUrl: string;
  roomId: string;
  peerId: string;
  peerName: string;
  targetPeerId: string;
  targetPeerName: string;
}

const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

function getWsUrl(serverUrl: string): string {
  const http = serverUrl.replace(/^http/, 'ws');
  return `${http}/ws/room`;
}

export function useWebRTCCall() {
  const [callState, setCallState] = useState<CallState>('idle');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const configRef = useRef<CallConfig | null>(null);
  const remotePeerRef = useRef<string | null>(null);

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

  // ── WebRTC Setup ──
  const createPeerConnection = useCallback(async (config: CallConfig): Promise<RTCPeerConnection> => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Track events
    pc.onicecandidate = (event) => {
      if (event.candidate && configRef.current) {
        wsRef.current?.send(JSON.stringify({
          type: 'ice_candidate',
          roomId: configRef.current.roomId,
          peerId: configRef.current.peerId,
          targetPeerId: configRef.current.targetPeerId,
          candidate: event.candidate,
        }));
      }
    };

    pc.ontrack = (event) => {
      // Remote audio stream — play through speaker
      const remoteAudio = new Audio();
      remoteAudio.srcObject = event.streams[0];
      remoteAudio.play().catch(() => {});
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
  }, [startTimer, stopTimer]);

  // ── Signaling WebSocket ──
  const connectSignaling = useCallback((config: CallConfig): Promise<void> => {
    return new Promise((resolve, reject) => {
      configRef.current = config;
      const wsUrl = getWsUrl(config.serverUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      let resolved = false;

      ws.onopen = () => {
        // Join the room
        ws.send(JSON.stringify({
          type: 'join',
          roomId: config.roomId,
          peerId: config.peerId,
          peerName: config.peerName,
        }));
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          const cfg = configRef.current;
          if (!cfg) return;

          switch (msg.type) {
            case 'join': {
              // Connected to signaling — we're in the room
              if (!resolved) {
                resolved = true;
                resolve();
              }
              // If there are existing peers, we'll get peer_joined events
              break;
            }

            case 'offer': {
              if (!cfg) break;
              setCallState('ringing');
              // Create peer connection for incoming call
              const pc = pcRef.current || await createPeerConnection(cfg);
              remotePeerRef.current = msg.peerId || '';
              await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              ws.send(JSON.stringify({
                type: 'answer',
                roomId: cfg.roomId,
                peerId: cfg.peerId,
                targetPeerId: msg.peerId || '',
                sdp: answer,
              }));
              setCallState('connecting');
              break;
            }

            case 'answer': {
              if (!pcRef.current) break;
              await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
              setCallState('connecting');
              break;
            }

            case 'ice_candidate': {
              if (!pcRef.current || !msg.candidate) break;
              try {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
              } catch (e) {
                console.log('[WebRTC] ICE candidate failed:', e);
              }
              break;
            }

            case 'peer_left': {
              setCallState('ended');
              stopTimer();
              break;
            }
          }
        } catch (e) {
          console.log('[WebRTC] WS message error:', e);
        }
      };

      ws.onerror = (e) => {
        if (!resolved) {
          resolved = true;
          reject(new Error('Signaling connection failed'));
        }
      };

      ws.onclose = () => {
        // Peer left or connection died
      };

      // Timeout
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('Signaling connection timeout'));
        }
      }, 10000);
    });
  }, [createPeerConnection, stopTimer]);

  // ── Start Call (outgoing) ──
  const startCall = useCallback(async (config: CallConfig) => {
    setCallState('calling');
    configRef.current = config;
    stopTimer();

    try {
      // Connect to signaling
      await connectSignaling(config);

      // Create peer connection
      const pc = await createPeerConnection(config);

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      wsRef.current?.send(JSON.stringify({
        type: 'offer',
        roomId: config.roomId,
        peerId: config.peerId,
        targetPeerId: config.targetPeerId,
        sdp: offer,
      }));

      setCallState('ringing');
    } catch (e: any) {
      console.log('[WebRTC] Start call failed:', e.message);
      setCallState('ended');
    }
  }, [connectSignaling, createPeerConnection, stopTimer]);

  // ── Accept incoming call ──
  const acceptCall = useCallback(async (config: CallConfig) => {
    configRef.current = config;
    setCallState('connecting');

    try {
      await connectSignaling(config);
      // The offer handler in ws.onmessage will create the PC and send answer
    } catch (e: any) {
      console.log('[WebRTC] Accept call failed:', e.message);
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

    // Leave signaling
    const cfg = configRef.current;
    if (wsRef.current && cfg) {
      wsRef.current.send(JSON.stringify({
        type: 'leave',
        roomId: cfg.roomId,
        peerId: cfg.peerId,
      }));
      wsRef.current.close();
      wsRef.current = null;
    }

    configRef.current = null;
  }, [stopTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);

  return {
    callState,
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
