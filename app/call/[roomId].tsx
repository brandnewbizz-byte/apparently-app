import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Vibration, Platform, Image,
} from 'react-native';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PhoneOff, Mic, MicOff, Volume2, VolumeX, User, Video, VideoOff, SwitchCamera,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useWebRTCCall, type CallConfig } from '@/hooks/useWebRTCCall';
import CallVideo from '@/components/CallVideo';
import { playTone, stopTone } from '@/lib/callTones';
import { claimCall, sendMissedCall, setCallUiActive } from '@/lib/calls';
import { dismissCallNotifications } from '@/lib/notifications';
import { callAudioAvailable } from '@/lib/callAudio';
import { callKitEndRoom, onCallKitHangUp } from '@/lib/callkit';

export default function CallScreen() {
  const params = useLocalSearchParams<{
    roomId: string;
    callerId: string;
    callerName: string;
    targetId: string;
    targetName: string;
    isOutgoing: string;
    currentUserId: string;
    currentUserName: string;
    video: string;
    peerAvatar: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const roomId = params.roomId || 'unknown';
  const callerId = params.callerId || '';
  const callerName = params.callerName || 'Someone';
  const targetId = params.targetId || '';
  const targetName = params.targetName || 'User';
  const isOutgoing = params.isOutgoing === '1' || params.isOutgoing === 'true';
  const isVideo = params.video === '1';
  const peerAvatar = params.peerAvatar || '';
  const currentUserId = params.currentUserId || user?.id || '';
  const currentUserName = params.currentUserName || (user as any)?.fullName || (user as any)?.username || 'You';

  const callConfig: CallConfig = useMemo(() => ({
    roomId,
    peerId: currentUserId,
    peerName: currentUserName,
    targetPeerId: isOutgoing ? targetId : callerId,
    targetPeerName: isOutgoing ? targetName : callerName,
    video: isVideo,
  }), [roomId, currentUserId, currentUserName, targetId, callerId, targetName, callerName, isOutgoing, isVideo]);

  const {
    callState, callError, duration, isMuted, isSpeakerOn, isCameraOff, localStream, remoteStream,
    startCall, acceptCall, endCall, toggleMute, toggleSpeaker, toggleCamera, switchCamera,
  } = useWebRTCCall();

  // Start (outgoing) or join (answered from a notification) once.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (isOutgoing) startCall(callConfig);
    else acceptCall(callConfig);
  }, [isOutgoing, callConfig, startCall, acceptCall]);

  // Ringback for the caller until the other person picks up.
  useEffect(() => {
    // Phones with call audio play ringback through it (see lib/callAudio).
    if (callAudioAvailable()) return;
    if (isOutgoing && callState === 'calling') playTone('ringback');
    else stopTone();
  }, [isOutgoing, callState]);
  useEffect(() => () => stopTone(), []);

  // While this screen is open other calls get "busy", and the call's push is cleared.
  useEffect(() => {
    setCallUiActive(true, `call:${roomId}`);
    claimCall(roomId);
    if (!isOutgoing) dismissCallNotifications();
    return () => setCallUiActive(false, `call:${roomId}`);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Nobody picked up: leave them a "Missed call".
  const missedSent = useRef(false);
  useEffect(() => {
    if (!isOutgoing || missedSent.current || callState !== 'ended' || callError !== 'No answer.') return;
    missedSent.current = true;
    sendMissedCall({
      me: { id: currentUserId, name: currentUserName, avatar: (user as any)?.avatar || '' },
      targetId,
      video: isVideo,
    });
  }, [isOutgoing, callState, callError, currentUserId, currentUserName, targetId, isVideo, user]);

  const closed = useRef(false);

  // Ring animation while waiting for the other person
  const ringAnim = useRef(new Animated.Value(1)).current;
  const waiting = callState === 'calling' || callState === 'ringing' || callState === 'connecting';
  useEffect(() => {
    if (!waiting) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, { toValue: 1.12, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(ringAnim, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [waiting, ringAnim]);

  const close = () => {
    closed.current = true;
    Vibration.cancel();
    if (router.canGoBack()) router.back();
    else router.replace('/inbox' as never);
  };

  // Call over: free the phone for the next call right away (no "busy" while
  // the summary shows), then close the summary by itself after 2 seconds.
  const focused = useIsFocused();
  const [closeDue, setCloseDue] = useState(false);
  useEffect(() => {
    if (callState !== 'ended') return;
    setCallUiActive(false, `call:${roomId}`);
    callKitEndRoom(roomId); // closes the iPhone's call screen too
    stopTone();
    Vibration.cancel();
    dismissCallNotifications();
    const t = setTimeout(() => setCloseDue(true), 2000);
    return () => clearTimeout(t);
  }, [callState]);
  useEffect(() => {
    // If a new call is ringing on top, wait until we're back on this screen.
    if (!closeDue || !focused || closed.current) return;
    closed.current = true;
    close();
  }, [closeDue, focused]); // eslint-disable-line react-hooks/exhaustive-deps

  const hangUp = () => {
    endCall();
    setTimeout(() => { if (!closed.current) close(); }, 300);
  };
  // Hanging up from the lock screen / Dynamic Island ends the call here too.
  const hangUpRef = useRef(hangUp);
  hangUpRef.current = hangUp;
  useEffect(() => onCallKitHangUp(roomId, () => hangUpRef.current()), [roomId]);
  useEffect(() => () => callKitEndRoom(roomId), [roomId]);

  const fmt = (secs: number) => `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`;

  const displayName = isOutgoing ? targetName : callerName;
  const isActive = callState === 'active';
  const showRemoteVideo = isVideo && isActive && !!remoteStream;

  if (callState === 'ended') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centerContent}>
          <Text style={styles.endTitle}>Call ended</Text>
          {callError ? (
            <Text style={styles.errorText}>{callError}</Text>
          ) : (
            <Text style={styles.endSub}>{duration > 0 ? fmt(duration) : displayName}</Text>
          )}
          <TouchableOpacity style={styles.backBtn} onPress={close}>
            <Text style={styles.backBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const status =
    callState === 'calling' ? 'Ringing…' :
    callState === 'ringing' ? 'Incoming call…' :
    callState === 'connecting' ? 'Connecting…' :
    callState === 'active' ? fmt(duration) : '';

  return (
    <View style={styles.container}>
      {/* Video: the other person full screen once connected, otherwise your own camera */}
      {isVideo ? (
        showRemoteVideo ? (
          <CallVideo stream={remoteStream} style={StyleSheet.absoluteFill} />
        ) : localStream && !isCameraOff ? (
          <CallVideo stream={localStream} mirror muted style={StyleSheet.absoluteFill} />
        ) : null
      ) : null}
      {isVideo ? <View style={[StyleSheet.absoluteFill, showRemoteVideo ? styles.videoShadeLight : styles.videoShade]} pointerEvents="none" /> : null}

      {/* Web voice calls: an invisible player for the other person's audio */}
      {!isVideo && Platform.OS === 'web' && remoteStream ? (
        <CallVideo stream={remoteStream} style={styles.hiddenPlayer} />
      ) : null}

      {/* Your camera in the corner once the video call is live */}
      {showRemoteVideo && localStream && !isCameraOff ? (
        <CallVideo stream={localStream} mirror muted zOrder={1} style={[styles.pip, { top: insets.top + 12 }]} />
      ) : null}

      <View style={[styles.overlay, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.statusText}>{status}</Text>

        {!showRemoteVideo ? (
          <>
            <Animated.View style={[styles.avatarRing, { transform: [{ scale: waiting ? ringAnim : 1 }] }]}>
              <View style={styles.avatarCircle}>
                {peerAvatar ? <Image source={{ uri: peerAvatar }} style={styles.avatarImg} /> : <User size={60} color="#FFFFFF" />}
              </View>
            </Animated.View>
            <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.stateLabel}>{isVideo ? 'Video call' : 'Voice call'}</Text>
          </>
        ) : (
          <Text style={styles.nameOnVideo} numberOfLines={1}>{displayName}</Text>
        )}

        <View style={{ flex: 1 }} />

        <View style={styles.controls}>
          <TouchableOpacity style={[styles.ctrlBtn, isMuted && styles.ctrlBtnActive]} onPress={toggleMute} accessibilityLabel={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? <MicOff size={24} color="#FFF" /> : <Mic size={24} color="#FFF" />}
            <Text style={styles.ctrlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>

          {isVideo ? (
            <TouchableOpacity style={[styles.ctrlBtn, isCameraOff && styles.ctrlBtnActive]} onPress={toggleCamera} accessibilityLabel={isCameraOff ? 'Turn camera on' : 'Turn camera off'}>
              {isCameraOff ? <VideoOff size={24} color="#FFF" /> : <Video size={24} color="#FFF" />}
              <Text style={styles.ctrlLabel}>Camera</Text>
            </TouchableOpacity>
          ) : null}

          {isVideo && Platform.OS !== 'web' ? (
            <TouchableOpacity style={styles.ctrlBtn} onPress={switchCamera} accessibilityLabel="Switch camera">
              <SwitchCamera size={24} color="#FFF" />
              <Text style={styles.ctrlLabel}>Flip</Text>
            </TouchableOpacity>
          ) : null}

          {Platform.OS !== 'web' ? (
            <TouchableOpacity style={[styles.ctrlBtn, isSpeakerOn && styles.ctrlBtnActive]} onPress={toggleSpeaker} accessibilityLabel="Speaker">
              {isSpeakerOn ? <Volume2 size={24} color="#FFF" /> : <VolumeX size={24} color="#FFF" />}
              <Text style={styles.ctrlLabel}>Speaker</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity style={styles.endBtn} onPress={hangUp} accessibilityLabel="End call">
          <PhoneOff size={30} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E21' },
  overlay: { flex: 1, alignItems: 'center', paddingHorizontal: 24 },
  videoShade: { backgroundColor: 'rgba(10,14,33,0.45)' },
  videoShadeLight: { backgroundColor: 'transparent' },
  hiddenPlayer: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  pip: {
    position: 'absolute', right: 16, width: 110, height: 160, borderRadius: 14, overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', zIndex: 5, backgroundColor: '#000',
  },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statusText: { color: '#C7D2FE', fontSize: 16, marginTop: 12, marginBottom: 32 },
  avatarRing: {
    width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(59, 130, 246, 0.2)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  avatarCircle: {
    width: 110, height: 110, borderRadius: 55, backgroundColor: '#3B82F6',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  avatarImg: { width: 110, height: 110 },
  name: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginBottom: 6, maxWidth: '90%' },
  nameOnVideo: {
    color: '#FFFFFF', fontSize: 20, fontWeight: '700', alignSelf: 'flex-start',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6, maxWidth: '60%',
  },
  stateLabel: { color: '#C7D2FE', fontSize: 16 },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, marginBottom: 28 },
  ctrlBtn: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  ctrlBtnActive: { backgroundColor: 'rgba(59,130,246,0.55)' },
  ctrlLabel: { color: '#FFFFFF', fontSize: 11, marginTop: 4 },
  endBtn: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: '#EF4444',
    justifyContent: 'center', alignItems: 'center',
  },
  endTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginBottom: 8 },
  endSub: { color: '#8B9DC3', fontSize: 18, marginBottom: 30 },
  errorText: { color: '#F87171', fontSize: 15, textAlign: 'center', marginBottom: 30, paddingHorizontal: 24 },
  backBtn: { backgroundColor: '#3B82F6', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 },
  backBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
