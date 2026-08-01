import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  Animated, ScrollView, Image, FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PhoneOff, Mic, MicOff, Camera, CameraOff, Users, Hand,
  MessageCircle, Sparkles, Share2, Smile,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTabBar } from '@/contexts/TabBarContext';
import { useRoom, RoomParticipant } from '@/contexts/RoomContext';
import { usePlan, PlanProvider } from '@/contexts/PlanContext';
import OverviewTab from './plan/OverviewTab';
import IdeasTab from './plan/IdeasTab';
import TasksTab from './plan/TasksTab';
import BudgetTab from './plan/BudgetTab';
import TimelineTab from './plan/TimelineTab';
import FilesTab from './plan/FilesTab';

const { width: SCREEN_W } = Dimensions.get('window');

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'ideas', label: 'Ideas' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'budget', label: 'Budget' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'files', label: 'Files' },
  { key: 'chat', label: 'Chat' },
  { key: 'people', label: 'People' },
];

const TAB_CONTENT: Record<string, React.FC> = {
  overview: OverviewTab,
  ideas: IdeasTab,
  tasks: TasksTab,
  budget: BudgetTab,
  timeline: TimelineTab,
  files: FilesTab,
};

function RoomContent() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const [loading, setLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { hideTabBar, showTabBar } = useTabBar();
  const {
    rooms, joinRoom, leaveRoom,
    startSpeaking, stopSpeaking, toggleCamera,
  } = useRoom();
  const { plan, createPlan, loadPlan } = usePlan();
  const glowAnim = useRef(new Animated.Value(0)).current;

  const room = rooms.find((r) => r.id === roomId);
  const participants = room?.participants || [];
  const speakingParticipants = participants.filter(p => p.isSpeaking);

  // ── Mount / Unmount ──
  useEffect(() => {
    if (roomId) {
      hideTabBar();
      joinRoom(roomId);
      loadPlan(roomId);
      createPlan(roomId, { title: room?.name || 'New Plan' });
      const t = setTimeout(() => setLoading(false), 500);
      return () => {
        clearTimeout(t);
        showTabBar();
        leaveRoom(roomId);
      };
    }
  }, [roomId]);

  // ── Speaking glow ──
  useEffect(() => {
    if (isSpeaking) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0.3, duration: 500, useNativeDriver: false }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
    glowAnim.setValue(0);
  }, [isSpeaking]);

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

  const handleCamera = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCameraOn(prev => !prev);
    toggleCamera(roomId || '');
  }, [roomId, toggleCamera]);

  const handleLeave = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    leaveRoom(roomId || '');
    router.back();
  }, [roomId, leaveRoom, router]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: '#0A0A0F' }]}>
        <View style={styles.connecting}>
          <Animated.View style={styles.connectingPulse} />
          <Text style={styles.connectingText}>Entering room...</Text>
        </View>
      </View>
    );
  }

  const ActiveTabContent = TAB_CONTENT[activeTab];

  return (
    <View style={[styles.container, { backgroundColor: '#0A0A0F' }]}>
      <LinearGradient
        colors={['rgba(139,92,246,0.10)', 'rgba(99,102,241,0.04)', '#0A0A0F']}
        style={styles.ambient}
      />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.roomName}>{room?.name || 'Room'}</Text>
            <View style={styles.headerMeta}>
              <View style={styles.headerBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
              {room?.creatorName && (
                <Text style={styles.hostText}>Host: {room.creatorName}</Text>
              )}
              <View style={styles.pCountRow}>
                <Users size={11} color="#9CA3AF" />
                <Text style={styles.pCountText}>{participants.length}</Text>
              </View>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerBtn}>
              <Share2 size={16} color="#9CA3AF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn}>
              <Sparkles size={16} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>
        {room?.goal && (
          <Text style={styles.goalText} numberOfLines={1}>
            🎯 {room.goal}
          </Text>
        )}
      </View>

      {/* ── Floating speaking participants ── */}
      {speakingParticipants.length > 0 && (
        <View style={styles.floatingParticipants} pointerEvents="none">
          {speakingParticipants.slice(0, 4).map((p, i) => (
            <View
              key={p.userId}
              style={[
                styles.floatingCircle,
                {
                  top: 80 + i * 70,
                  right: 10,
                },
              ]}
            >
              <Image
                source={{
                  uri: p.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.fullName)}&background=8B5CF6&color=fff&size=80`,
                }}
                style={styles.floatingAvatar}
              />
              <View style={styles.speakingRing} />
            </View>
          ))}
        </View>
      )}

      {/* ── Tab Bar ── */}
      <View style={[styles.tabBar, { borderBottomColor: '#1F2937' }]}>
        <FlatList
          horizontal
          data={TABS}
          showsHorizontalScrollIndicator={false}
          keyExtractor={t => t.key}
          contentContainerStyle={{ paddingHorizontal: 8, gap: 4 }}
          renderItem={({ item }) => {
            const isActive = activeTab === item.key;
            return (
              <TouchableOpacity
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTab(item.key);
                }}
              >
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* ── Plan Content ── */}
      <View style={styles.content}>
        {ActiveTabContent ? (
          <ActiveTabContent />
        ) : activeTab === 'chat' ? (
          <View style={styles.placeholder}>
            <MessageCircle size={36} color="#4B5563" />
            <Text style={styles.placeholderTitle}>Chat</Text>
            <Text style={styles.placeholderSub}>Room chat coming soon</Text>
          </View>
        ) : activeTab === 'people' ? (
          <View style={styles.placeholder}>
            <Users size={36} color="#4B5563" />
            <Text style={styles.placeholderTitle}>People</Text>
            <Text style={styles.placeholderSub}>
              {participants.length} participant{participants.length !== 1 ? 's' : ''} in this room
            </Text>
            <ScrollView style={{ width: '100%', marginTop: 12 }}>
              {participants.map(p => (
                <View key={p.userId} style={styles.personRow}>
                  <Image
                    source={{
                      uri: p.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.fullName)}&background=374151&color=fff&size=60`,
                    }}
                    style={styles.personAvatar}
                  />
                  <Text style={styles.personName}>{p.fullName}</Text>
                  {p.isSpeaking && <Text style={styles.speakingLabel}>🔊</Text>}
                  {p.hasCamera && <Text style={styles.speakingLabel}>📹</Text>}
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>

      {/* ── Controls ── */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 6 }]}>
        {/* Raise Hand */}
        <TouchableOpacity
          style={[styles.smallBtn, handRaised && { backgroundColor: '#F59E0B' }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setHandRaised(prev => !prev);
          }}
        >
          <Hand size={18} color={handRaised ? '#FFF' : '#9CA3AF'} />
        </TouchableOpacity>

        {/* Hold to Talk */}
        <TouchableOpacity
          style={[styles.micBtn, isSpeaking && styles.micBtnActive]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.7}
        >
          <Animated.View style={[
            styles.micInner,
            isSpeaking && { transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] },
          ]}>
            {isSpeaking ? (
              <Mic size={26} color="#FFF" />
            ) : (
              <MicOff size={26} color="#FFF" />
            )}
          </Animated.View>
          <Text style={styles.controlLabel}>
            {isSpeaking ? 'Speaking...' : 'Hold to Talk'}
          </Text>
        </TouchableOpacity>

        {/* Hold for Camera */}
        <TouchableOpacity
          style={[styles.micBtn, cameraOn && { backgroundColor: '#8B5CF6' }]}
          onPress={handleCamera}
          activeOpacity={0.7}
        >
          <Animated.View style={styles.micInner}>
            {cameraOn ? (
              <Camera size={26} color="#FFF" />
            ) : (
              <CameraOff size={26} color="#FFF" />
            )}
          </Animated.View>
          <Text style={styles.controlLabel}>
            {cameraOn ? 'On Camera' : 'Camera'}
          </Text>
        </TouchableOpacity>

        {/* Leave */}
        <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave}>
          <PhoneOff size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Speaking indicator */}
      {isSpeaking && (
        <Animated.View style={[styles.glowBar, { opacity: glowAnim }]} pointerEvents="none">
          <LinearGradient
            colors={['rgba(139,92,246,0)', 'rgba(139,92,246,0.5)', 'rgba(99,102,241,0.6)', 'rgba(139,92,246,0.5)', 'rgba(139,92,246,0)']}
            style={styles.glowGradient}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          />
        </Animated.View>
      )}
    </View>
  );
}

// Wrapper with PlanProvider
export default function RoomScreen() {
  return (
    <PlanProvider>
      <RoomContent />
    </PlanProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  ambient: { ...StyleSheet.absoluteFillObject },
  connecting: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  connectingPulse: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(139,92,246,0.2)' },
  connectingText: { color: '#9CA3AF', fontSize: 15 },

  // Header
  header: { paddingHorizontal: 14, paddingBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  roomName: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  headerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  liveText: { color: '#10B981', fontSize: 10, fontWeight: '700' },
  hostText: { color: '#9CA3AF', fontSize: 12, fontWeight: '500' },
  pCountRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  pCountText: { color: '#9CA3AF', fontSize: 12, fontWeight: '600' },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1F2937', alignItems: 'center', justifyContent: 'center' },
  goalText: { color: '#8B5CF6', fontSize: 13, fontWeight: '500', marginTop: 6 },

  // Floating
  floatingParticipants: { position: 'absolute', top: 0, right: 0, zIndex: 10 },
  floatingCircle: { position: 'absolute', alignItems: 'center' },
  floatingAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#8B5CF6' },
  speakingRing: { position: 'absolute', width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: '#A78BFA', opacity: 0.5 },

  // Tab Bar
  tabBar: { borderBottomWidth: 1, paddingVertical: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16 },
  tabActive: { backgroundColor: '#8B5CF6' },
  tabLabel: { color: '#9CA3AF', fontSize: 13, fontWeight: '600' },
  tabLabelActive: { color: '#FFF' },

  // Content
  content: { flex: 1 },

  // Placeholder
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 8 },
  placeholderTitle: { color: '#9CA3AF', fontSize: 16, fontWeight: '600' },
  placeholderSub: { color: '#6B7280', fontSize: 14 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 16 },
  personAvatar: { width: 32, height: 32, borderRadius: 16 },
  personName: { color: '#D1D5DB', fontSize: 14, fontWeight: '500', flex: 1 },
  speakingLabel: { fontSize: 14 },

  // Controls
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 14, paddingVertical: 12, paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  smallBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#1F2937', alignItems: 'center', justifyContent: 'center',
  },
  micBtn: {
    width: 66, height: 66, borderRadius: 33,
    backgroundColor: 'rgba(139,92,246,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  micBtnActive: { backgroundColor: '#8B5CF6' },
  micInner: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#8B5CF6', alignItems: 'center', justifyContent: 'center',
  },
  controlLabel: { color: '#9CA3AF', fontSize: 9, fontWeight: '600', position: 'absolute', bottom: -16 },
  leaveBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center',
  },
  glowBar: { position: 'absolute', bottom: 72, left: 0, right: 0, height: 3 },
  glowGradient: { flex: 1 },
});
