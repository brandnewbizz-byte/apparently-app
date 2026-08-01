import {
  Radio, Plus, Users, Circle, Zap, Sparkles, X, Hash,
} from 'lucide-react-native';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, RefreshControl, Modal, TextInput,
  KeyboardAvoidingView, Platform, Dimensions, Image,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useTabBar } from '@/contexts/TabBarContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRoom, LiveRoom } from '@/contexts/RoomContext';

const { width: SCREEN_W } = Dimensions.get('window');

export default function LiveScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { handleScroll: handleTabBarScroll } = useTabBar();
  const { rooms, createRoom, fetchRooms } = useRoom();

  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomTopic, setRoomTopic] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const SUGGESTED_TOPICS = [
    'Build Plans', 'Design Sprint', 'Ideas', 'Resources', 'Feedback', 'Chill',
  ];

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRooms().finally(() => setRefreshing(false));
  }, [fetchRooms]);

  // ── Create Room ──
  const handleCreateRoom = useCallback(async () => {
    if (!roomName.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsCreating(true);
    try {
      const room = await createRoom(roomName.trim(), roomTopic.trim());
      setRoomName('');
      setRoomTopic('');
      setShowCreateModal(false);
      if (room) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.push(`/(tabs)/live/room/${room.id}` as any);
      }
    } catch {
      // fall through
    }
    setIsCreating(false);
  }, [roomName, roomTopic, createRoom, router]);

  // ── Join Room ──
  const handleJoinRoom = useCallback((room: LiveRoom) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/(tabs)/live/room/${room.id}` as any);
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[
        styles.header,
        {
          paddingTop: insets.top + 8,
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <LinearGradient
              colors={['#8B5CF6', '#6366F1']}
              style={styles.headerIcon}
            >
              <Radio size={20} color="#FFF" />
            </LinearGradient>
            <View>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Spot</Text>
              <Text style={[styles.headerSub, { color: colors.textTertiary }]}>
                {rooms.length > 0
                  ? `${rooms.length} room${rooms.length > 1 ? 's' : ''} live`
                  : 'Live collaboration space'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowCreateModal(true);
            }}
          >
            <Plus size={16} color="#FFF" />
            <Text style={styles.createBtnText}>Create Room</Text>
          </TouchableOpacity>
        </View>

        {/* Tagline */}
        <View style={[styles.tagline, { backgroundColor: colors.accent + '0C' }]}>
          <Sparkles size={13} color={colors.accent} />
          <Text style={[styles.taglineText, { color: colors.textSecondary }]}>
            Go live · Build together · Share resources
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => handleTabBarScroll(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ── Live Now ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLabel}>
                <View style={styles.pulsingDot} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Live Now</Text>
              </View>
            </View>

            {rooms.length === 0 ? (
              <View style={styles.emptyState}>
                <Circle size={48} color={colors.accent + '30'} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  No rooms live yet
                </Text>
                <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
                  Create the first room and invite your network
                </Text>
                <TouchableOpacity
                  style={styles.emptyCreateBtn}
                  onPress={() => setShowCreateModal(true)}
                >
                  <Zap size={16} color="#FFF" />
                  <Text style={styles.emptyCreateText}>Start a Room</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.roomGrid}>
                {rooms.map((room) => (
                  <TouchableOpacity
                    key={room.id}
                    style={[
                      styles.roomCard,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                    activeOpacity={0.9}
                    onPress={() => handleJoinRoom(room)}
                  >
                    <LinearGradient
                      colors={['#8B5CF6', '#6366F1']}
                      style={styles.roomGradient}
                    >
                      <View style={styles.roomLiveIndicator}>
                        <View style={styles.roomLiveDot} />
                        <Text style={styles.roomLiveText}>LIVE</Text>
                      </View>
                    </LinearGradient>

                    <View style={styles.roomCardBody}>
                      <Text
                        style={[styles.roomCardName, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {room.name}
                      </Text>

                      {room.topic ? (
                        <View style={styles.roomTopicRow}>
                          <Hash size={12} color={colors.accent} />
                          <Text
                            style={[styles.roomTopicText, { color: colors.accent }]}
                            numberOfLines={1}
                          >
                            {room.topic}
                          </Text>
                        </View>
                      ) : null}

                      <View style={styles.roomCardFooter}>
                        <View style={styles.roomCreator}>
                          <Image
                            source={{
                              uri: room.creatorAvatar
                                || `https://ui-avatars.com/api/?name=${encodeURIComponent(room.creatorName)}&background=8B5CF6&color=fff&size=40`,
                            }}
                            style={styles.roomCreatorAvatar}
                          />
                          <Text
                            style={[styles.roomCreatorName, { color: colors.textSecondary }]}
                            numberOfLines={1}
                          >
                            {room.creatorName}
                          </Text>
                        </View>
                        <View style={styles.roomParticipants}>
                          <Users size={13} color={colors.textTertiary} />
                          <Text style={[styles.roomParticipantCount, { color: colors.textTertiary }]}>
                            {room.participants?.length || 1}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* ── Info Card ── */}
          <View style={[
            styles.infoCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}>
            <View style={styles.infoRow}>
              <View style={[styles.infoBullet, { backgroundColor: colors.accent + '20' }]}>
                <Sparkles size={14} color={colors.accent} />
              </View>
              <View>
                <Text style={[styles.infoTitle, { color: colors.text }]}>How rooms work</Text>
                <Text style={[styles.infoDesc, { color: colors.textTertiary }]}>
                  Press-hold mic to talk · Tap camera for video · Build plans & share resources together
                </Text>
              </View>
            </View>
          </View>

          <View style={{ height: 120 }} />
        </Animated.View>
      </ScrollView>

      {/* ── Create Room Modal ── */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
            {/* Modal Header */}
            <View style={[
              styles.modalHeader,
              { paddingTop: insets.top + 8, borderBottomColor: colors.border },
            ]}>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <X size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Create Room</Text>
              <TouchableOpacity
                style={[
                  styles.modalCreateBtn,
                  {
                    backgroundColor: roomName.trim() ? colors.accent : colors.surface,
                    opacity: roomName.trim() ? 1 : 0.5,
                  },
                ]}
                onPress={handleCreateRoom}
                disabled={!roomName.trim() || isCreating}
              >
                <Zap size={12} color="#FFF" />
                <Text style={styles.modalCreateText}>
                  {isCreating ? 'Creating...' : 'Go Live'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <ScrollView contentContainerStyle={styles.modalBody}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  Room Name
                </Text>
                <TextInput
                  style={[styles.fieldInput, {
                    backgroundColor: colors.surface,
                    color: colors.text,
                    borderColor: colors.border,
                  }]}
                  placeholder="Give your room a name"
                  placeholderTextColor={colors.textTertiary}
                  value={roomName}
                  onChangeText={setRoomName}
                  maxLength={60}
                  returnKeyType="next"
                  autoFocus
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  Topic
                </Text>
                <TextInput
                  style={[styles.fieldInput, {
                    backgroundColor: colors.surface,
                    color: colors.text,
                    borderColor: colors.border,
                  }]}
                  placeholder="What are you working on?"
                  placeholderTextColor={colors.textTertiary}
                  value={roomTopic}
                  onChangeText={setRoomTopic}
                  maxLength={80}
                  returnKeyType="done"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>
                  Suggestions
                </Text>
                <View style={styles.topicRow}>
                  {SUGGESTED_TOPICS.map((topic) => {
                    const active = roomTopic === topic;
                    return (
                      <TouchableOpacity
                        key={topic}
                        style={[
                          styles.topicChip,
                          {
                            backgroundColor: active ? colors.accent : colors.surface,
                            borderColor: active ? colors.accent : colors.border,
                          },
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setRoomTopic(active ? '' : topic);
                        }}
                      >
                        <Text style={[
                          styles.topicChipText,
                          { color: active ? '#FFF' : colors.textSecondary },
                        ]}>
                          {topic}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Preview card */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>
                  Preview
                </Text>
                <View style={[
                  styles.previewCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}>
                  <LinearGradient
                    colors={['#8B5CF6', '#6366F1']}
                    style={styles.previewGradient}
                  >
                    <View style={styles.previewLive}>
                      <View style={styles.previewDot} />
                      <Text style={styles.previewLiveText}>LIVE</Text>
                    </View>
                  </LinearGradient>
                  <View style={styles.previewBody}>
                    <Text style={[styles.previewName, { color: colors.text }]}>
                      {roomName.trim() || 'Room Name'}
                    </Text>
                    <Text style={[styles.previewTopic, { color: colors.textTertiary }]}>
                      {roomTopic.trim() || 'No topic set'}
                    </Text>
                    <View style={styles.previewFooter}>
                      <View style={[
                        styles.previewAvatar,
                        { backgroundColor: colors.accent + '30' },
                      ]}>
                        <Text style={styles.previewAvatarText}>
                          {(user?.fullName || 'Y')[0].toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[styles.previewCreator, { color: colors.textSecondary }]}>
                        {user?.fullName || 'You'}
                      </Text>
                      <View style={styles.previewParticipants}>
                        <Users size={11} color={colors.textTertiary} />
                        <Text style={[styles.previewCount, { color: colors.textTertiary }]}>1</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },

  // ── Header ──
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 1 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#8B5CF6', paddingHorizontal: 16,
    paddingVertical: 10, borderRadius: 24,
  },
  createBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  tagline: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 10,
  },
  taglineText: { fontSize: 13, fontWeight: '500' },

  // ── Section ──
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pulsingDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981',
  },
  sectionTitle: { fontSize: 17, fontWeight: '700' },

  // ── Empty ──
  emptyState: {
    alignItems: 'center', paddingVertical: 48, gap: 10,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600' },
  emptySub: {
    fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20,
  },
  emptyCreateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#8B5CF6', paddingHorizontal: 20,
    paddingVertical: 12, borderRadius: 24, marginTop: 8,
  },
  emptyCreateText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  // ── Room Grid ──
  roomGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
  },
  roomCard: {
    width: (SCREEN_W - 44) / 2,
    borderRadius: 16, borderWidth: 1, overflow: 'hidden',
  },
  roomGradient: {
    height: 80, alignItems: 'center', justifyContent: 'center',
  },
  roomLiveIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 12,
  },
  roomLiveDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF',
  },
  roomLiveText: {
    color: '#FFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.5,
  },
  roomCardBody: { padding: 12 },
  roomCardName: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  roomTopicRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10,
  },
  roomTopicText: { fontSize: 12, fontWeight: '600' },
  roomCardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  roomCreator: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1,
  },
  roomCreatorAvatar: { width: 20, height: 20, borderRadius: 10 },
  roomCreatorName: { fontSize: 11, fontWeight: '500', flex: 1 },
  roomParticipants: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  roomParticipantCount: { fontSize: 12, fontWeight: '600' },

  // ── Info Card ──
  infoCard: {
    marginHorizontal: 16, marginTop: 24, padding: 16,
    borderRadius: 14, borderWidth: 1,
  },
  infoRow: { flexDirection: 'row', gap: 12 },
  infoBullet: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  infoTitle: { fontSize: 15, fontWeight: '600', marginBottom: 3 },
  infoDesc: { fontSize: 13, lineHeight: 19, paddingRight: 8 },

  // ── Modal ──
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  modalCreateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24,
  },
  modalCreateText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  modalBody: { padding: 16, gap: 20 },

  // ── Fields ──
  fieldGroup: { gap: 8 },
  fieldLabel: {
    fontSize: 13, fontWeight: '600', textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  fieldInput: {
    fontSize: 16, paddingHorizontal: 14, paddingVertical: 14,
    borderRadius: 12, borderWidth: 1,
  },
  topicRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topicChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
  },
  topicChipText: { fontSize: 13, fontWeight: '600' },

  // ── Preview ──
  previewCard: { borderRadius: 14, overflow: 'hidden', borderWidth: 1 },
  previewGradient: {
    height: 60, alignItems: 'center', justifyContent: 'center',
  },
  previewLive: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 10,
    paddingVertical: 3, borderRadius: 12,
  },
  previewDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF',
  },
  previewLiveText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  previewBody: { padding: 12 },
  previewName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  previewTopic: { fontSize: 13, marginBottom: 10 },
  previewFooter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewAvatar: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  previewAvatarText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  previewCreator: { fontSize: 12, fontWeight: '500', flex: 1 },
  previewParticipants: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  previewCount: { fontSize: 11, fontWeight: '600' },
});
