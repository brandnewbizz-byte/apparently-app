import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  Animated, ScrollView, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Phone, PhoneOff, Mic, MicOff, Camera, CameraOff, Users, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRoom, RoomParticipant } from '@/contexts/RoomContext';

const { width: SCREEN_W } = Dimensions.get('window');
const CIRCLE_SIZE = 90;
const GRID_GAP = 14;

export default function RoomScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const [loading, setLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const {
    rooms, joinRoom, leaveRoom,
    startSpeaking, stopSpeaking, toggleCamera,
  } = useRoom();

  const room = rooms.find((r) => r.id === roomId);
  const participants = room?.participants || [];
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (roomId) {
      joinRoom(roomId);
      const t = setTimeout(() => setLoading(false), 600);
      return () => {
        clearTimeout(t);
        leaveRoom(roomId);
      };
    }
  }, [roomId]);

  // Speaking glow pulse
  useEffect(() => {
    if (isSpeaking) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 520, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0.3, duration: 520, useNativeDriver: false }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
    glowAnim.setValue(0);
  }, [isSpeaking]);

  // ── Push-to-talk handlers ──
  const handlePressIn = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsSpeaking(true);
    startSpeaking(roomId || '');
  }, [roomId, startSpeaking]);

  const handlePressOut = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSpeaking(false);
    stopSpeaking(roomId || '');
  }, [roomId, stopSpeaking]);

  // ── Camera toggle ──
  const handleCameraToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCameraOn((prev) => !prev);
    toggleCamera(roomId || '');
  }, [roomId, toggleCamera]);

  // ── Leave ──
  const handleLeave = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    leaveRoom(roomId || '');
    router.back();
  }, [roomId, leaveRoom, router]);

  // ── Grid layout ──
  const maxPerRow = Math.floor((SCREEN_W - 32) / (CIRCLE_SIZE + GRID_GAP));
  const rows: RoomParticipant[][] = [];
  for (let i = 0; i < participants.length; i += maxPerRow) {
    rows.push(participants.slice(i, i + maxPerRow));
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: '#0A0A0F' }]}>
        <View style={styles.connecting}>
          <Animated.View style={[styles.connectingPulse]} />
          <Text style={styles.connectingText}>Connecting...</Text>
        </View>
      </View>
    );
  }

  if (!room) {
    return (
      <View style={[styles.container, { backgroundColor: '#0A0A0F' }]}>
        <View style={styles.connecting}>
          <Text style={styles.connectingText}>Room not found</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#0A0A0F' }]}>
      {/* Ambient gradient background */}
      <LinearGradient
        colors={['rgba(139,92,246,0.12)', 'rgba(99,102,241,0.06)', '#0A0A0F']}
        style={styles.ambient}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={styles.roomName}>{room.name}</Text>
          {room.topic ? <Text style={styles.roomTopic}>{room.topic}</Text> : null}
        </View>
        <View style={styles.badge}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>LIVE</Text>
        </View>
        <View style={styles.participantCount}>
          <Users size={14} color="#9CA3AF" />
          <Text style={styles.countText}>{participants.length}</Text>
        </View>
      </View>

      {/* Participant Grid */}
      <ScrollView
        style={styles.gridScroll}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
      >
        {participants.length === 0 ? (
          <View style={styles.emptyRoom}>
            <Users size={40} color="rgba(139,92,246,0.3)" />
            <Text style={styles.emptyTitle}>Waiting for people...</Text>
            <Text style={styles.emptySub}>Share this room with your network</Text>
          </View>
        ) : (
          rows.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.row}>
              {row.map((p, idx) => {
                const isSelf = p.userId === user?.id;
                const displaySpeaking = isSelf ? isSpeaking : p.isSpeaking;
                return (
                  <View key={p.userId || idx} style={styles.circleWrapper}>
                    <View
                      style={[
                        styles.circleOuter,
                        displaySpeaking && styles.circleSpeaking,
                      ]}
                    >
                      <Image
                        source={{
                          uri: p.avatar
                            || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.fullName || 'U')}&background=8B5CF6&color=fff&size=120`,
                        }}
                        style={styles.circleAvatar}
                      />
                      {p.hasCamera && (
                        <View style={styles.cameraBadge}>
                          <Camera size={10} color="#FFF" />
                        </View>
                      )}
                    </View>
                    <Text style={styles.circleName} numberOfLines={1}>
                      {isSelf ? 'You' : p.fullName || 'User'}
                    </Text>
                    {displaySpeaking && (
                      <Animated.View
                        style={[
                          styles.speakingBar,
                          { opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
                        ]}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      {/* Control Bar */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 8 }]}>
        {/* Camera toggle */}
        <TouchableOpacity
          style={[styles.cameraBtn, cameraOn && styles.cameraBtnActive]}
          onPress={handleCameraToggle}
        >
          {cameraOn ? <Camera size={20} color="#FFF" /> : <CameraOff size={20} color="#9CA3AF" />}
        </TouchableOpacity>

        {/* Press-hold Mic */}
        <TouchableOpacity
          style={[styles.micBtn, isSpeaking && styles.micBtnActive]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.7}
        >
          <Animated.View style={[
            styles.micInner,
            isSpeaking && {
              transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }],
            },
          ]}>
            {isSpeaking ? <Mic size={28} color="#FFF" /> : <MicOff size={28} color="#FFF" />}
          </Animated.View>
        </TouchableOpacity>

        {/* Leave */}
        <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave}>
          <PhoneOff size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Speaking glow bar */}
      {isSpeaking && (
        <Animated.View
          style={[styles.glowBar, { opacity: glowAnim }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={['rgba(139,92,246,0)', 'rgba(139,92,246,0.4)', 'rgba(99,102,241,0.5)', 'rgba(139,92,246,0.4)', 'rgba(139,92,246,0)']}
            style={styles.glowGradient}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  ambient: {
    ...StyleSheet.absoluteFillObject,
  },

  // ── Connecting ──
  connecting: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  connectingPulse: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(139,92,246,0.2)',
  },
  connectingText: { color: '#9CA3AF', fontSize: 16 },
  backBtn: {
    marginTop: 8, paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 24, backgroundColor: '#8B5CF6',
  },
  backBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },

  // ── Header ──
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12, gap: 12,
  },
  roomName: { color: '#FFF', fontSize: 20, fontWeight: '700', flex: 1 },
  roomTopic: { color: '#8B5CF6', fontSize: 13, fontWeight: '600', marginTop: 2 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 12,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  badgeText: { color: '#10B981', fontSize: 11, fontWeight: '700' },
  participantCount: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 10,
    paddingVertical: 6, borderRadius: 12,
  },
  countText: { color: '#9CA3AF', fontSize: 12, fontWeight: '600' },

  // ── Grid ──
  gridScroll: { flex: 1 },
  gridContent: { padding: 16, alignItems: 'center' },
  row: {
    flexDirection: 'row', justifyContent: 'center',
    gap: GRID_GAP, marginBottom: 24, flexWrap: 'wrap',
  },
  circleWrapper: { alignItems: 'center', width: CIRCLE_SIZE + 10 },
  circleOuter: {
    width: CIRCLE_SIZE, height: CIRCLE_SIZE, borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 3, borderColor: 'rgba(139,92,246,0.3)',
    overflow: 'hidden',
  },
  circleSpeaking: {
    borderColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.7,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  circleAvatar: {
    width: '100%', height: '100%', borderRadius: CIRCLE_SIZE / 2,
  },
  cameraBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center',
  },
  circleName: {
    color: '#D1D5DB', fontSize: 11, fontWeight: '500',
    marginTop: 6, width: CIRCLE_SIZE + 10, textAlign: 'center',
  },
  speakingBar: {
    width: CIRCLE_SIZE, height: 3, borderRadius: 2,
    backgroundColor: '#8B5CF6', marginTop: 4,
  },

  // ── Empty ──
  emptyRoom: {
    alignItems: 'center', paddingVertical: 80, gap: 10,
  },
  emptyTitle: { color: '#9CA3AF', fontSize: 17, fontWeight: '600' },
  emptySub: { color: '#6B7280', fontSize: 14 },

  // ── Controls ──
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 24, paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  cameraBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  cameraBtnActive: {
    backgroundColor: '#8B5CF6',
  },
  micBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(139,92,246,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: '#8B5CF6',
  },
  micInner: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#8B5CF6',
    alignItems: 'center', justifyContent: 'center',
  },
  leaveBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
  },
  glowBar: {
    position: 'absolute', bottom: 90, left: 0, right: 0, height: 4,
  },
  glowGradient: { flex: 1 },
});
