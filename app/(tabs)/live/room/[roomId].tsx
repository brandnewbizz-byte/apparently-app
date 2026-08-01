import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  Animated, ScrollView, Image, FlatList, PanResponder,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PhoneOff, Mic, MicOff, Camera, CameraOff, Users, Hand,
  MessageCircle, Sparkles, Share2, X, Monitor, Eye, Crown, Shield, UserCheck, Radio,
  Repeat2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTabBar } from '@/contexts/TabBarContext';
import { useRoom, RoomParticipant, type ActivityEntry } from '@/contexts/RoomContext';
import { usePlan, PlanProvider } from '@/contexts/PlanContext';

import { useLiveAudio } from '@/hooks/useLiveAudio';
import { useRoomHistory, type HistoryEntry, type HistoryAction } from '@/hooks/useRoomHistory';
import { useRoomRoles, useRolePermissionsSafe } from '@/hooks/useRoomRoles';
import { EditIndicator } from '@/components/live/EditIndicator';
import { RoleBadge } from '@/components/live/RoleBadge';
import { HistoryFeed } from '@/components/live/HistoryFeed';
import { PresentationOverlay } from '@/components/live/PresentationOverlay';
import OverviewTab from './plan/OverviewTab';
import IdeasTab from './plan/IdeasTab';
import TasksTab from './plan/TasksTab';
import BudgetTab from './plan/BudgetTab';
import TimelineTab from './plan/TimelineTab';
import FilesTab from './plan/FilesTab';
import VirtualRoomScreen from './virtual';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'ideas', label: 'Ideas' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'budget', label: 'Budget' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'files', label: 'Files' },
  { key: 'history', label: 'History' },
  { key: 'chat', label: 'Chat' },
  { key: 'virtual', label: 'Virtual' },
  { key: 'people', label: 'People' },
];

const TAB_CONTENT: Record<string, React.FC> = {
  overview: OverviewTab,
  ideas: IdeasTab,
  tasks: TasksTab,
  budget: BudgetTab,
  timeline: TimelineTab,
  files: FilesTab,
  virtual: VirtualTab,
};

// ── Virtual Tab Wrapper ──
function VirtualTab() {
  return <VirtualRoomScreen />;
}

// ── Animated Speaking Ring ──
function SpeakingRing({ size = 52, color = '#A78BFA', pulseSpeed = 600 }: {
  size?: number; color?: string; pulseSpeed?: number;
}) {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: pulseSpeed, useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0.3, duration: pulseSpeed, useNativeDriver: false }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseSpeed]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: color,
        opacity: anim,
        transform: [{
          scale: anim.interpolate({ inputRange: [0.3, 1], outputRange: [1, 1.25] }),
        }],
      }}
    />
  );
}

// ── Draggable Camera Bubble (real CameraView for local, avatar for remote) ──
function CameraBubble({ onClose, participant, isLocal, onPress, facing, onFlip, }: {
  onClose: () => void;
  participant: { fullName: string; avatar: string | null; userId?: string };
  isLocal?: boolean;
  onPress?: () => void;
  facing?: 'front' | 'back';
  onFlip?: () => void;
}) {
  const pan = useRef(new Animated.ValueXY({ x: SCREEN_W / 2 - 55, y: SCREEN_H * 0.4 })).current;
  const scale = useRef(new Animated.Value(1)).current;
  const positionRef = useRef({ x: SCREEN_W / 2 - 55, y: SCREEN_H * 0.4 });

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      pan.setOffset({ x: positionRef.current.x, y: positionRef.current.y });
      pan.setValue({ x: 0, y: 0 });
      Animated.spring(scale, { toValue: 1.08, useNativeDriver: false }).start();
    },
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, gesture) => {
      pan.flattenOffset();
      positionRef.current = {
        x: positionRef.current.x + gesture.dx,
        y: positionRef.current.y + gesture.dy,
      };
      Animated.spring(scale, { toValue: 1, useNativeDriver: false }).start();
    },
  }), []);

  return (
    <Animated.View
      style={[
        styles.cameraBubble,
        { transform: [...pan.getTranslateTransform(), { scale }] },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Tap to expand (remote cameras) */}
      <TouchableOpacity
        style={styles.cameraPreview}
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
        disabled={!onPress}
      >
        {isLocal ? (
          <CameraView
            style={styles.cameraImg}
            facing={facing || 'front'}
            mirror={facing === 'front' || !facing}
          />
        ) : (
          <Image
            source={{
              uri: participant.avatar
                || `https://ui-avatars.com/api/?name=${encodeURIComponent(participant.fullName)}&background=E5E5E5&color=333&size=160`,
            }}
            style={styles.cameraImg}
          />
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
          style={styles.cameraGradient}
        >
          <Text style={styles.cameraName} numberOfLines={1}>{participant.fullName}</Text>
        </LinearGradient>
      </TouchableOpacity>
      {/* Flip camera button (local only) */}
      {isLocal && onFlip && (
        <TouchableOpacity style={styles.flipBtn} onPress={onFlip}>
          <Repeat2 size={14} color="#FFF" strokeWidth={1.5} />
        </TouchableOpacity>
      )}
      {/* Close button */}
      <TouchableOpacity style={styles.cameraClose} onPress={onClose}>
        <X size={14} color="#FFF" />
      </TouchableOpacity>
      {/* Drag hint */}
      <View style={styles.dragHandle}>
        <View style={styles.dragHandleBar} />
      </View>
    </Animated.View>
  );
}

// ── Animated Participant Circle ──
function ParticipantCircle({ p, size, showName, showRole }: {
  p: RoomParticipant; size?: number; showName?: boolean; showRole?: boolean;
}) {
  const s = size || 44;
  const roleIcon = p.role === 'host' ? '👑' : p.role === 'co_host' ? '⭐' : null;
  return (
    <View style={[styles.participantWrap, { width: s + 20, height: s + 50 }]}>
      <View style={{ width: s, height: s }}>
        <Image
          source={{
            uri: p.avatar
              || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.fullName)}&background=8B5CF6&color=fff&size=${s * 2}`,
          }}
          style={[styles.participantImg, {
            width: s, height: s, borderRadius: s / 2,
            borderWidth: p.isSpeaking ? 2 : 1,
            borderColor: p.isSpeaking ? '#A78BFA' : 'rgba(255,255,255,0.1)',
          }]}
        />
        {p.isSpeaking && (
          <SpeakingRing size={s + 10} color="#A78BFA" pulseSpeed={600} />
        )}
        {p.hasCamera && (
          <View style={styles.cameraBadge}>
            <Camera size={10} color="#FFF" fill="#FFF" />
          </View>
        )}
        {showRole && roleIcon && (
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{roleIcon}</Text>
          </View>
        )}
      </View>
      {showName && (
        <Text style={styles.participantNameText} numberOfLines={1}>
          {p.isSpeaking ? '🔊 ' : ''}{p.fullName.split(' ')[0]}
        </Text>
      )}
    </View>
  );
}

// ── Main Room Content ──
function RoomContent() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const [loading, setLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraPermission, setCameraPermission] = useState(false);
  const [cameraPermDenied, setCameraPermDenied] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [expandedCamera, setExpandedCamera] = useState<{ userId: string; fullName: string; isLocal: boolean } | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  // handRaised/setHandRaised removed — using RoomContext toggleRaiseHand
  // presenterTab/setPresenterTab from RoomContext — syncs via supabase realtime
  const [activeTab, setActiveTab] = useState('overview');
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();

  // ── Live Audio (push-to-talk + multi-speaker) ──
  const audio = useLiveAudio({
    roomId: roomId || '',
    peerId: user?.id || '',
    peerName: user?.fullName || 'Anonymous',
    enabled: !!roomId,
    onMutedByHost: () => setIsSpeaking(false),
  });
  const { hideTabBar, showTabBar } = useTabBar();
  const {
    rooms, joinRoom, leaveRoom,
    startSpeaking, stopSpeaking, toggleCamera,
    toggleRaiseHand,
    startPresenting, stopPresenting,
    muteParticipant, unmuteParticipant, removeParticipant, changeRole,
    setPresenterTab, presenterTab,
    isHost, isCoHostOrAbove, getUserRole,
    enterFollowMode, leaveFollowMode, returnToLivePresentation,
    viewMode, setViewMode, currentRoom, addActivity,
    goLive, endLive, deleteRoom, generateInviteLink,
  } = useRoom();
  const { plan, createPlan, loadPlan, saveNow } = usePlan();

  // ── Room Roles ──
  const { role: myRole, permissions: myPerms, isEditorOrAbove } = useRoomRoles();

  // ── Room History ──
  const history = useRoomHistory({
    roomId: roomId || '',
    enabled: !!roomId,
    limit: 100,
  });
  const glowAnim = useRef(new Animated.Value(0)).current;
  const micScale = useRef(new Animated.Value(1)).current;

  const room = rooms.find((r) => r.id === roomId);

  // Merge local activityLog + Supabase room_history (deduped by id)
  const mergedHistoryEntries = useMemo(() => {
    const localEntries: HistoryEntry[] = (room?.activityLog || []).map((a: ActivityEntry) => ({
      id: a.id,
      roomId: room?.id || '',
      userId: a.userId,
      userName: a.userName,
      action: a.action as HistoryAction,
      detail: a.detail,
      timestamp: a.timestamp,
    }));
    // Dedupe: prefer Supabase entries (they may have richer data)
    const serverIds = new Set(history.entries.map(e => e.id));
    const uniqueLocal = localEntries.filter(e => !serverIds.has(e.id));
    return [...history.entries, ...uniqueLocal].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [room?.activityLog, history.entries, room?.id]);
  const participants = room?.participants || [];
  const speakingParticipants = participants.filter(p => p.isSpeaking);
  const cameraParticipants = participants.filter(p => p.hasCamera);
  const currentUserP = participants.find(p => p.userId === user?.id);
  const isPresenting = room?.presentationState === 'presenting';
  const isUserPresenting = room?.presenterId === user?.id;
  const isUserFollowing = currentUserP?.followMode === true;
  const presenterParticipant = room?.presenterId
    ? participants.find(p => p.userId === room.presenterId)
    : null;
  const userRole = getUserRole();
  const userIsHost = isHost();
  const userIsHostOrAbove = isCoHostOrAbove();

  // ── Mount / Unmount ──
  useEffect(() => {
    if (roomId) {
      hideTabBar();
      joinRoom(roomId);
      loadPlan(roomId);
      createPlan(roomId, { title: room?.name || 'New Plan' });
      // Connect push-to-talk audio relay
      audio.joinRoom();
      const t = setTimeout(() => setLoading(false), 600);
      return () => {
        clearTimeout(t);
        showTabBar();
        leaveRoom(roomId);
        audio.leaveRoom();
      };
    }
  }, [roomId]);

  // 🗂 Follow presenter tab navigation 🗂
  useEffect(() => {
    if (!roomId || !isUserFollowing || isUserPresenting) return;
    const channel = supabase.channel(`room:${roomId}`);
    channel.on(
      'broadcast',
      { event: 'presenter_tab_change' },
      (payload: any) => {
        if (payload?.payload?.tab) setActiveTab(payload.payload.tab);
      }
    ).subscribe();
    return () => { supabase.removeChannel(channel).then(() => {}, () => {}); };
  }, [roomId, isUserFollowing, isUserPresenting]);

  // ── Mic glow pulse ──
  useEffect(() => {
    if (isSpeaking) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0.2, duration: 400, useNativeDriver: false }),
        ]),
      );
      Animated.loop(
        Animated.sequence([
          Animated.spring(micScale, { toValue: 1.15, useNativeDriver: false, speed: 12 }),
          Animated.spring(micScale, { toValue: 1, useNativeDriver: false, speed: 12 }),
        ]),
      ).start();
      pulse.start();
      return () => pulse.stop();
    }
    glowAnim.setValue(0);
    micScale.setValue(1);
  }, [isSpeaking]);

  const handlePressIn = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsSpeaking(true);
    startSpeaking(roomId || '');
    // Push-to-talk via live audio relay
    audio.micPressIn();
  }, [roomId, startSpeaking, audio]);

  const handlePressOut = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSpeaking(false);
    stopSpeaking(roomId || '');
    // Release push-to-talk
    audio.micPressOut();
  }, [roomId, stopSpeaking, audio]);

  // ── Camera Permissions ──
  const [camPerm, requestCamPerm] = useCameraPermissions();

  const handleCamera = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!cameraOn) {
      // Turning ON: request camera permission first
      const perm = camPerm?.granted ? camPerm : await requestCamPerm();
      if (!perm?.granted) {
        setCameraPermDenied(true);
        return;
      }
      setCameraPermission(true);
      setCameraPermDenied(false);
    } else {
      // Turning OFF: release camera
      setCameraPermission(false);
    }
    setCameraOn(prev => !prev);
    toggleCamera(roomId || '');
  }, [roomId, toggleCamera, cameraOn, camPerm, requestCamPerm]);

  const handleLeave = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    leaveRoom(roomId || '');
    router.back();
  }, [roomId, leaveRoom, router]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
        <View style={styles.connecting}>
          <Animated.View style={styles.connectingRing}>
            <View style={styles.connectingDot} />
          </Animated.View>
          <Text style={styles.connectingText}>Entering room...</Text>
        </View>
      </View>
    );
  }

  const ActiveTabContent = TAB_CONTENT[activeTab];

  return (
    <View style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
      <LinearGradient
        colors={['rgba(139,92,246,0.06)', 'rgba(99,102,241,0.02)', '#FFFFFF']}
        style={styles.ambient}
      />

      {/* ── Tab Bar (sticky at top) ── */}
      <View style={[styles.tabBar, { borderBottomColor: '#EFEFEF', paddingTop: insets.top + 4 }]}>
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
                  if (isPresenting && isUserPresenting) {
                    setPresenterTab(item.key);
                  }
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

      {/* ── Scrollable Content (header, participants, plan content) ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        nestedScrollEnabled={true}
        showsVerticalScrollIndicator={false}
      >
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.roomName}>{room?.name || 'Room'}</Text>
            <View style={styles.headerMeta}>
              <View style={[
                styles.headerBadge,
                room?.status === 'draft' && { backgroundColor: 'rgba(245,158,11,0.12)' },
                room?.status === 'ended' && { backgroundColor: 'rgba(107,114,128,0.12)' },
              ]}>
                <View style={[
                  styles.liveDot,
                  room?.status === 'draft' && { backgroundColor: '#D97706' },
                  room?.status === 'ended' && { backgroundColor: '#6B7280' },
                ]} />
                <Text style={[
                  styles.liveText,
                  room?.status === 'draft' && { color: '#D97706' },
                  room?.status === 'ended' && { color: '#6B7280' },
                ]}>
                  {room?.status === 'draft' ? 'SETUP' : room?.status === 'ended' ? 'ENDED' : 'LIVE'}
                </Text>
              </View>
              {room?.creatorName && (
                <Text style={styles.hostText}>Host: {room.creatorName}</Text>
              )}
              <View style={styles.pCountRow}>
                <Users size={11} color="#737373" />
                <Text style={styles.pCountText}>{participants.length}</Text>
              </View>
              {speakingParticipants.length > 0 && (
                <Text style={styles.speakingCount}>
                  {speakingParticipants.length} speaking
                </Text>
              )}
            </View>
          </View>
          <View style={styles.headerActions}>
            {room?.status === 'draft' && userIsHostOrAbove && (
              <TouchableOpacity
                style={[styles.manageBtn, { backgroundColor: 'rgba(16,185,129,0.12)' }]}
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  goLive(roomId || '');
                }}
              >
                <Radio size={14} color="#10B981" />
                <Text style={[styles.manageBtnText, { color: '#10B981' }]}>Go Live</Text>
              </TouchableOpacity>
            )}
            {room?.status === 'live' && userIsHostOrAbove && (
              <TouchableOpacity
                style={styles.manageBtn}
                onPress={() => setShowAdminPanel(true)}
              >
                <Crown size={14} color="#F59E0B" />
                <Text style={styles.manageBtnText}>Manage</Text>
              </TouchableOpacity>
            )}
            {room?.status === 'live' && (
              <TouchableOpacity
                style={[styles.presentBtn, { backgroundColor: '#EF4444' }]}
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  endLive(roomId || '');
                }}
              >
                <Monitor size={14} color="#FFF" />
                <Text style={styles.presentBtnText}>End Live</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => {
                const link = generateInviteLink(roomId || '');
                // Copy to clipboard via Share API
                const { Share } = require('react-native');
                Share.share({ message: `Join my live room on Apparently: ${link}`, url: link }).catch(() => {});
              }}
            >
              <Share2 size={16} color="#737373" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn}>
              <Sparkles size={16} color="#737373" />
            </TouchableOpacity>
          </View>
        </View>
        {room?.goal && (
          <Text style={styles.goalText} numberOfLines={1}>
            🎯 {room.goal}
          </Text>
        )}
      </View>

      {/* ── Presenter Bar ── */}
      {isPresenting && room?.presenterName && (
        <View style={styles.presenterBar}>
          <View style={styles.presenterBadge}>
            <Monitor size={13} color="#10B981" />
            <Text style={styles.presenterText}>{room.presenterName} is presenting</Text>
          </View>
          {userIsHostOrAbove && !isUserPresenting && (
            <TouchableOpacity
              style={styles.presenterAction}
              onPress={() => { stopPresenting(); }}
            >
              <Text style={styles.presenterActionText}>End</Text>
            </TouchableOpacity>
          )}
          {isUserPresenting && (
            <TouchableOpacity
              style={[styles.presenterAction, { backgroundColor: '#EF4444' }]}
              onPress={() => { stopPresenting(); }}
            >
              <Text style={styles.presenterActionText}>Stop</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Participant Bar ── */}
      <View style={styles.pBar}>
        <FlatList
          horizontal
          data={participants}
          showsHorizontalScrollIndicator={false}
          keyExtractor={p => p.userId}
          contentContainerStyle={styles.pBarContent}
          renderItem={({ item }) => (
            <ParticipantCircle p={item} size={38} showName showRole />
          )}
        />
      </View>

      {/* ── Edit Indicators ── */}
      <EditIndicator
        indicators={(currentRoom?.editIndicators || []).map(e => ({
          userId: e.userId,
          userName: e.userName,
          section: e.section,
          tab: e.section,
          startedAt: e.startedAt,
        }))}
        currentUserId={user?.id}
      />

      {/* ── Presentation Overlay ── */}
      <PresentationOverlay
        visible={true}
        isPresenter={isPresenting && isUserPresenting}
        presenterName={currentRoom?.presenterName || null}
        isFollowing={isUserFollowing}
        onStartPresenting={startPresenting}
        onStopPresenting={stopPresenting}
        onEnterFollow={enterFollowMode}
        onLeaveFollow={leaveFollowMode}
        onRequestControl={() => {}}
        onTakeBackControl={() => {}}
        pendingRequests={[]}
        onApproveRequest={() => {}}
        canPresent={isHost() || isCoHostOrAbove()}
      />

      {/* ── Follow Mode Banner ── */}
      {isPresenting && isUserFollowing && !isUserPresenting && (
        <View style={styles.followBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Eye size={14} color="#A78BFA" />
            <Text style={styles.followBannerText}>
              Following {room?.presenterName}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.followReturnBtn}
            onPress={() => { leaveFollowMode(); }}
          >
            <Text style={styles.followReturnText}>Browse freely</Text>
          </TouchableOpacity>
        </View>
      )}
      {isPresenting && !isUserFollowing && !isUserPresenting && (
        <TouchableOpacity
          style={styles.followBanner}
          onPress={() => { enterFollowMode(); }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Eye size={14} color="#6B7280" />
            <Text style={[styles.followBannerText, { color: '#737373' }]}>
              {room?.presenterName} is presenting — tap to follow
            </Text>
          </View>
          <Text style={styles.followReturnText}>Follow →</Text>
        </TouchableOpacity>
      )}

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
        ) : activeTab === 'history' ? (
          <HistoryFeed
            entries={mergedHistoryEntries}
            isLoading={history.isLoading}
            onRefresh={history.refresh}
          />
        ) : activeTab === 'people' ? (
          <View style={styles.placeholder}>
            <Users size={36} color="#4B5563" />
            <Text style={styles.placeholderTitle}>People ({participants.length})</Text>
            <ScrollView style={{ width: '100%', marginTop: 12 }}>
              {participants.map(p => (
                <View key={p.userId} style={styles.personRow}>
                  <View style={{ width: 36, height: 36 }}>
                    <Image
                      source={{
                        uri: p.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.fullName)}&background=E5E5E5&color=333&size=72`,
                      }}
                      style={styles.personAvatar}
                    />
                    {p.isSpeaking && <SpeakingRing size={44} color="#A78BFA" pulseSpeed={500} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.personName}>{p.fullName}</Text>
                      <RoleBadge role={p.role} isCreator={currentRoom?.creatorId === p.userId} size="sm" />
                    </View>
                    {p.isSpeaking && <Text style={styles.speakingLabel}>🔊 Speaking</Text>}
                    {p.hasCamera && <Text style={styles.speakingLabel}>📹 Camera on</Text>}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>
      </ScrollView>

      {/* ── Draggable Camera Bubbles ── */}
      {cameraParticipants.map(p => {
        if (p.userId !== user?.id && !cameraOn) {
          return (
            <CameraBubble
              key={`cam-${p.userId}`}
              participant={p}
              onClose={() => {}}
              onPress={() => setExpandedCamera({ userId: p.userId, fullName: p.fullName, isLocal: false })}
            />
          );
        }
        return null;
      })}
      {cameraOn && currentUserP && (
        <CameraBubble
          participant={currentUserP}
          onClose={handleCamera}
          isLocal
          facing={facing}
          onFlip={() => setFacing(prev => prev === 'front' ? 'back' : 'front')}
          onPress={() => setExpandedCamera({ userId: user?.id || '', fullName: currentUserP.fullName, isLocal: true })}
        />
      )}

      {/* ── Expanded Camera Overlay ── */}
      {expandedCamera && (
        <View style={styles.expandedCameraOverlay}>
          {expandedCamera.isLocal ? (
            <CameraView style={styles.expandedCamera} facing={facing} mirror={facing === 'front'} />
          ) : (
            <Image
              source={{ uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(expandedCamera.fullName)}&background=E5E5E5&color=333&size=400` }}
              style={styles.expandedCamera}
            />
          )}
          <View style={styles.expandedCameraBar}>
            <Text style={styles.expandedCameraName}>{expandedCamera.fullName}</Text>
            <Text style={styles.expandedCameraHint}>
              {expandedCamera.isLocal ? 'Your camera' : 'Viewing camera'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.expandedClose}
            onPress={() => setExpandedCamera(null)}
          >
            <X size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Admin Panel ── */}
      {showAdminPanel && (
        <View style={styles.adminOverlay}>
          <View style={styles.adminPanel}>
            <View style={styles.adminHeader}>
              <Crown size={20} color="#F59E0B" />
              <Text style={styles.adminTitle}>Room Management</Text>
              <TouchableOpacity onPress={() => setShowAdminPanel(false)}>
                <X size={20} color="#737373" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.adminList}>
              {participants.map(p => (
                <View key={p.userId} style={styles.adminRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Image
                      source={{ uri: p.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.fullName)}&background=E5E5E5&color=333&size=48` }}
                      style={{ width: 32, height: 32, borderRadius: 16 }}
                    />
                    <View>
                      <Text style={styles.adminRowName}>{p.fullName}</Text>
                      <RoleBadge role={p.role} isCreator={currentRoom?.creatorId === p.userId} size="sm" />
                    </View>
                  </View>
                  {p.userId !== user?.id && (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        style={styles.adminActionBtn}
                        onPress={() => {
                          if (p.isMuted) unmuteParticipant(roomId || '', p.userId);
                          else muteParticipant(roomId || '', p.userId);
                        }}
                      >
                        {p.isMuted ? <MicOff size={14} color="#EF4444" /> : <Mic size={14} color="#10B981" />}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.adminActionBtn, styles.adminActionDanger]}
                        onPress={() => removeParticipant(roomId || '', p.userId)}
                      >
                        <X size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* ── Camera Permission Alert ── */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 6 }]}>
        {/* Stop Presenting — replaces controls when user is presenting */}
        {isUserPresenting ? (
          <TouchableOpacity
            style={[styles.micBtn, { maxWidth: SCREEN_W - 60 }]}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              stopPresenting();
            }}
            activeOpacity={0.7}
          >
            <View style={[
              styles.micOuter,
              { backgroundColor: 'rgba(239,68,68,0.3)', borderColor: 'rgba(239,68,68,0.6)' },
            ]}>
              <View style={[styles.micInner, { backgroundColor: '#EF4444' }]}>
                <Monitor size={24} color="#FFF" />
              </View>
            </View>
            <Text style={[styles.controlLabel, { color: '#EF4444' }]}>
              Stop Presenting
            </Text>
          </TouchableOpacity>
        ) : (
          <>
            {/* Raise Hand */}
            <TouchableOpacity
          style={[styles.smallBtn, currentUserP?.handRaised && styles.raiseActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            toggleRaiseHand(roomId || '');
          }}
        >
          <Hand size={18} color={currentUserP?.handRaised ? '#FFF' : '#737373'} />
        </TouchableOpacity>

        {/* Hold to Talk */}
        <TouchableOpacity
          style={[styles.micBtn]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.7}
        >
          <Animated.View style={[
            styles.micOuter,
            isSpeaking && {
              backgroundColor: 'rgba(139,92,246,0.3)',
              borderColor: 'rgba(139,92,246,0.6)',
            },
          ]}>
            <Animated.View style={[
              styles.micInner,
              isSpeaking && { backgroundColor: '#8B5CF6', borderColor: '#A78BFA' },
              { transform: [{ scale: micScale }] },
            ]}>
              {isSpeaking ? (
                <Mic size={24} color="#FFF" />
              ) : (
                <MicOff size={24} color="#FFF" />
              )}
            </Animated.View>
          </Animated.View>
          <Text style={styles.controlLabel}>
            {isSpeaking ? 'You\'re live' : 'Hold to Talk'}
          </Text>
        </TouchableOpacity>

        {/* Camera */}
        <TouchableOpacity
          style={[styles.micBtn]}
          onPress={handleCamera}
          activeOpacity={0.7}
        >
          <View style={[
            styles.micOuter,
            cameraOn && {
              backgroundColor: 'rgba(16,185,129,0.3)',
              borderColor: 'rgba(16,185,129,0.6)',
            },
          ]}>
            <View style={[
              styles.micInner,
              cameraOn && { backgroundColor: '#10B981' },
            ]}>
              {cameraOn ? (
                <Camera size={24} color="#FFF" />
              ) : (
                <CameraOff size={24} color="#FFF" />
              )}
            </View>
          </View>
          <Text style={styles.controlLabel}>
            {cameraOn ? 'On Camera' : 'Camera'}
          </Text>
        </TouchableOpacity>

        {/* Leave */}
        <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave}>
          <PhoneOff size={18} color="#FFF" />
        </TouchableOpacity>
          </>
        )}
      </View>

      {/* Speaking glow at bottom */}
      {isSpeaking && (
        <Animated.View style={[styles.glowBar, { opacity: glowAnim }]} pointerEvents="none">
          <LinearGradient
            colors={['rgba(139,92,246,0)', 'rgba(139,92,246,0.6)', '#8B5CF6', 'rgba(99,102,241,0.6)', 'rgba(139,92,246,0)']}
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
  connectingRing: {
    width: 60, height: 60, borderRadius: 30,
    borderWidth: 2, borderColor: 'rgba(139,92,246,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  connectingDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#8B5CF6',
  },
  connectingText: { color: '#737373', fontSize: 15 },

  // Header
  header: { paddingHorizontal: 14, paddingBottom: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  roomName: { color: '#262626', fontSize: 20, fontWeight: '700' },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  headerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  liveText: { color: '#10B981', fontSize: 10, fontWeight: '700' },
  hostText: { color: '#737373', fontSize: 12, fontWeight: '500' },
  pCountRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  pCountText: { color: '#737373', fontSize: 12, fontWeight: '600' },
  speakingCount: { color: '#8B5CF6', fontSize: 11, fontWeight: '600' },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  goalText: { color: '#8B5CF6', fontSize: 13, fontWeight: '500', marginTop: 6 },

  // Participant Bar
  pBar: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#EFEFEF' },
  pBarContent: { paddingHorizontal: 10, gap: 2 },
  participantWrap: { alignItems: 'center', justifyContent: 'center' },
  participantImg: { borderWidth: 1, borderColor: '#DBDBDB' },
  participantNameText: { color: '#737373', fontSize: 9, fontWeight: '600', marginTop: 4, textAlign: 'center', maxWidth: 50 },
  cameraBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center',
  },

  // Tab Bar
  tabBar: { borderBottomWidth: 1, borderBottomColor: '#EFEFEF', paddingVertical: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16 },
  tabActive: { backgroundColor: '#8B5CF6' },
  tabLabel: { color: '#8E8E8E', fontSize: 13, fontWeight: '600' },
  tabLabelActive: { color: '#FFF' },

  // Content
  content: { minHeight: SCREEN_H * 0.85 },

  // Placeholder
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 8 },
  placeholderTitle: { color: '#737373', fontSize: 16, fontWeight: '600' },
  placeholderSub: { color: '#8E8E8E', fontSize: 14 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 16 },
  personAvatar: { width: 36, height: 36, borderRadius: 18 },
  personName: { color: '#262626', fontSize: 14, fontWeight: '500', flex: 1 },
  speakingLabel: { fontSize: 14, color: '#262626' },

  // Camera Bubble
  cameraBubble: {
    position: 'absolute', zIndex: 100, elevation: 10,
    width: 110, alignItems: 'center',
  },
  cameraPreview: {
    width: 110, height: 110, borderRadius: 55, overflow: 'hidden',
    borderWidth: 2, borderColor: '#10B981',
  },
  cameraImg: { width: 110, height: 110, borderRadius: 55 },
  cameraGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 36, justifyContent: 'flex-end', paddingHorizontal: 10, paddingBottom: 6,
  },
  cameraName: { color: '#FFF', fontSize: 10, fontWeight: '600' },
  cameraClose: {
    position: 'absolute', top: -4, right: -4,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center',
  },
  dragHandle: {
    marginTop: 6, width: 30, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)', alignItems: 'center',
  },
  dragHandleBar: {
    width: 18, height: 3, borderRadius: 1.5,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },

  // Controls
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 16, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1, borderTopColor: '#EFEFEF',
  },
  smallBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center',
  },
  raiseActive: { backgroundColor: '#F59E0B' },
  micBtn: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  micOuter: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#F0F0F0',
    borderWidth: 1, borderColor: '#DBDBDB',
    alignItems: 'center', justifyContent: 'center',
  },
  micInner: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#E5E5E5', alignItems: 'center', justifyContent: 'center',
  },
  controlLabel: { color: '#8E8E8E', fontSize: 9, fontWeight: '600', position: 'absolute', bottom: -16 },
  leaveBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center',
  },
  glowBar: { position: 'absolute', bottom: 80, left: 0, right: 0, height: 3 },
  glowGradient: { flex: 1 },

  // Presenter Bar
  presenterBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(16,185,129,0.06)', paddingHorizontal: 12,
    paddingVertical: 8, borderBottomWidth: 1,
    borderBottomColor: 'rgba(16,185,129,0.1)',
  },
  presenterBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  presenterText: { color: '#10B981', fontSize: 12, fontWeight: '600' },
  presenterAction: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 10,
  },
  presenterActionText: { color: '#10B981', fontSize: 11, fontWeight: '700' },
  presentBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#8B5CF6', paddingHorizontal: 12,
    paddingVertical: 7, borderRadius: 17,
  },
  presentBtnText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  // Follow Banner
  followBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(139,92,246,0.04)', paddingHorizontal: 12,
    paddingVertical: 7,
  },
  followBannerText: { color: '#8B5CF6', fontSize: 11, fontWeight: '600' },
  followReturnBtn: {
    backgroundColor: 'rgba(139,92,246,0.1)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  followReturnText: { color: '#8B5CF6', fontSize: 10, fontWeight: '600' },

  // Role Badge
  roleBadge: {
    position: 'absolute', top: -2, right: -2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#DBDBDB',
  },
  roleBadgeText: { fontSize: 9 },

  // ── Camera Flip ──
  flipBtn: {
    position: 'absolute', top: 6, right: 30,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  flipBtnText: { fontSize: 14 },

  // ── Manage Button ──
  manageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(245,158,11,0.12)', paddingHorizontal: 10,
    paddingVertical: 7, borderRadius: 17, borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  manageBtnText: { color: '#D97706', fontSize: 11, fontWeight: '700' },

  // ── Expanded Camera Overlay ──
  expandedCameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000', zIndex: 100, justifyContent: 'center', alignItems: 'center',
  },
  expandedCamera: {
    width: SCREEN_W, height: SCREEN_H * 0.75, position: 'absolute', top: 0,
  },
  expandedCameraBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)', paddingHorizontal: 20, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  expandedCameraName: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  expandedCameraHint: { color: '#A8A8A8', fontSize: 12, marginTop: 2 },
  expandedClose: {
    position: 'absolute', top: 50, right: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },

  // ── Admin Panel ──
  adminOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 99,
    justifyContent: 'flex-end',
  },
  adminPanel: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: SCREEN_H * 0.6, paddingBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 16, elevation: 20,
  },
  adminHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  adminTitle: { color: '#262626', fontSize: 16, fontWeight: '700', flex: 1 },
  adminList: { paddingHorizontal: 20, paddingTop: 8 },
  adminRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EFEFEF',
  },
  adminRowName: { color: '#262626', fontSize: 13, fontWeight: '600' },
  adminActionBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center',
  },
  adminActionDanger: { backgroundColor: 'rgba(239,68,68,0.1)' },
});
