import React, { useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Vibration, Platform, SafeAreaView, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, User,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWebRTCCall, type CallConfig } from '@/hooks/useWebRTCCall';

export default function CallScreen() {
  const params = useLocalSearchParams<{
    roomId: string;
    callerId: string;
    callerName: string;
    targetId: string;
    targetName: string;
    isOutgoing: string;
    serverUrl: string;
    currentUserId: string;
    currentUserName: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const roomId = params.roomId || 'unknown';
  const callerId = params.callerId || '';
  const callerName = params.callerName || 'Someone';
  const targetId = params.targetId || '';
  const targetName = params.targetName || 'User';
  const isOutgoing = params.isOutgoing === 'true';
  const serverUrl = params.serverUrl || 'http://localhost:3000';
  const currentUserId = params.currentUserId || user?.id || '';
  const currentUserName = params.currentUserName || (user as any)?.fullName || user?.name || 'You';

  const callConfig: CallConfig = useMemo(() => ({
    serverUrl,
    roomId,
    peerId: currentUserId,
    peerName: currentUserName,
    targetPeerId: isOutgoing ? targetId : callerId,
    targetPeerName: isOutgoing ? targetName : callerName,
  }), [serverUrl, roomId, currentUserId, currentUserName, targetId, callerId, targetName, callerName, isOutgoing]);

  const {
    callState, duration, isMuted, isSpeakerOn,
    startCall, acceptCall, endCall, toggleMute, toggleSpeaker,
  } = useWebRTCCall();

  // Ring animation
  const ringAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (callState === 'ringing' || callState === 'calling') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(ringAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(ringAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      // Vibrate
      if (Platform.OS !== 'web') {
        Vibration.vibrate([500, 500, 500], true);
      }
      return () => {
        pulse.stop();
        Vibration.cancel();
      };
    }
  }, [callState, ringAnim]);

  // Start or accept
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOutgoing && callState === 'idle') {
        startCall(callConfig);
      } else if (!isOutgoing && callState === 'idle') {
        acceptCall(callConfig);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [isOutgoing, callState, callConfig, startCall, acceptCall]);

  // End call & go back
  const handleEndCall = () => {
    Vibration.cancel();
    endCall();
    setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/inbox');
    }, 400);
  };

  // Format duration
  const fmtDuration = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const displayName = isOutgoing ? targetName : callerName;
  const isRinging = callState === 'calling' || callState === 'ringing';
  const isConnected = callState === 'active';
  const isEnded = callState === 'ended';

  if (isEnded) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centerContent}>
          <Text style={styles.endTitle}>Call Ended</Text>
          <Text style={styles.endSub}>{fmtDuration(duration)}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={handleEndCall}>
            <Text style={styles.backBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.overlay, { paddingTop: insets.top + 20 }]}>
        {/* Status */}
        <Text style={styles.statusText}>
          {callState === 'calling' ? 'Calling...' :
           callState === 'ringing' ? 'Incoming call...' :
           callState === 'connecting' ? 'Connecting...' :
           callState === 'active' ? fmtDuration(duration) : ''}
        </Text>

        {/* Avatar + Name */}
        <Animated.View style={[styles.avatarRing, { transform: [{ scale: isRinging ? ringAnim : 1 }] }]}>
          <View style={styles.avatarCircle}>
            <User size={60} color="#FFFFFF" />
          </View>
        </Animated.View>

        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.stateLabel}>
          {callState === 'calling' ? 'Ringing...' :
           callState === 'ringing' ? 'Wants to talk' :
           callState === 'connecting' ? 'Establishing connection...' :
           callState === 'active' ? 'On call' : ''}
        </Text>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Incoming: Accept / Reject */}
        {callState === 'ringing' && !isOutgoing && (
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, styles.declineBtn]} onPress={handleEndCall}>
              <PhoneOff size={28} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]} onPress={() => acceptCall(callConfig)}>
              <Phone size={28} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Active: Mute / Speaker / End */}
        {callState === 'active' || callState === 'connecting' || (callState === 'ringing' && isOutgoing) ? (
          <View style={styles.controls}>
            <TouchableOpacity style={[styles.ctrlBtn, isMuted && styles.ctrlBtnActive]} onPress={toggleMute}>
              {isMuted ? <MicOff size={24} color="#FFF" /> : <Mic size={24} color="#FFF" />}
              <Text style={styles.ctrlLabel}>Mute</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.ctrlBtn, isSpeakerOn && styles.ctrlBtnActive]} onPress={toggleSpeaker}>
              {isSpeakerOn ? <Volume2 size={24} color="#FFF" /> : <VolumeX size={24} color="#FFF" />}
              <Text style={styles.ctrlLabel}>Speaker</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.ctrlBtn, styles.endCtrlBtn]} onPress={handleEndCall}>
              <PhoneOff size={24} color="#FFF" />
              <Text style={styles.ctrlLabel}>End</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Outgoing: Cancel */}
        {callState === 'calling' && isOutgoing && (
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, styles.declineBtn]} onPress={handleEndCall}>
              <PhoneOff size={28} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E21',
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    color: '#8B9DC3',
    fontSize: 16,
    marginTop: 12,
    marginBottom: 40,
  },
  avatarRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
  },
  stateLabel: {
    color: '#8B9DC3',
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 48,
    paddingBottom: 60,
  },
  actionBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtn: {
    backgroundColor: '#22C55E',
  },
  declineBtn: {
    backgroundColor: '#EF4444',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
    paddingBottom: 50,
  },
  ctrlBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctrlBtnActive: {
    backgroundColor: 'rgba(59,130,246,0.4)',
  },
  endCtrlBtn: {
    backgroundColor: '#EF4444',
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  ctrlLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    marginTop: 4,
  },
  endTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  endSub: {
    color: '#8B9DC3',
    fontSize: 18,
    marginBottom: 30,
  },
  backBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
