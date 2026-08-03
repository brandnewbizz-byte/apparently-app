import {
  Radio, Plus, Users, Circle, Zap, Sparkles, X, Hash, Camera, Image as ImageIcon,
} from 'lucide-react-native';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, RefreshControl, Modal, TextInput, Alert,
  KeyboardAvoidingView, Platform, Dimensions, Image,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useTabBar } from '@/contexts/TabBarContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRoom, LiveRoom } from '@/contexts/RoomContext';
import { ENVIRONMENT_OPTIONS } from '@/types/virtual-room';

const { width: SCREEN_W } = Dimensions.get('window');

export default function LiveScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { handleScroll: handleTabBarScroll } = useTabBar();
  const { rooms, createRoom, fetchRooms } = useRoom();

  // Only show user's own rooms
  const myRooms = useMemo(() => rooms.filter(r => r.creatorId === user?.id), [rooms, user?.id]);

  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomTopic, setRoomTopic] = useState('');
  const [roomEnvironment, setRoomEnvironment] = useState('generic');
  const [isCreating, setIsCreating] = useState(false);
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

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

  // ── Pick Cover Image ──
  const pickCoverImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library to set a room cover.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setCoverImageUri(result.assets[0].uri);
    }
  }, []);

  // ── Upload cover to Supabase Storage ──
  const uploadCoverImage = useCallback(async (roomId: string): Promise<string | null> => {
    if (!coverImageUri) return null;
    try {
      const ext = coverImageUri.split('.').pop()?.split('?')[0] || 'jpg';
      const path = `covers/${roomId}/cover.${ext}`;
      const blob: any = await fetch(coverImageUri).then(r => r.blob());
      const { error } = await supabase.storage
        .from('room-files')
        .upload(path, blob, { upsert: true, contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}` });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('room-files').getPublicUrl(path);
      return publicUrl;
    } catch (e: any) {
      console.log('[Cover Upload] failed:', e?.message || e);
      return null;
    }
  }, [coverImageUri]);

  // ── Create Room ──
  const handleCreateRoom = useCallback(async () => {
    if (!roomName.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsCreating(true);
    try {
      // Step 1: Create room in DB (cover image uploaded after)
      const room = await createRoom(roomName.trim(), roomTopic.trim(), {
        environment: roomEnvironment,
      });
      if (!room) { setIsCreating(false); return; }

      // Step 2: Upload cover image to Supabase Storage if selected
      let publicUrl: string | null = null;
      if (coverImageUri) {
        setIsUploadingCover(true);
        publicUrl = await uploadCoverImage(room.id);
        setIsUploadingCover(false);
      }

      // Step 3: If cover was uploaded, persist the public URL to the DB
      if (publicUrl) {
        const { data, error } = await supabase
          .from('rooms')
          .update({ cover_image: publicUrl })
          .eq('id', room.id)
          .select('cover_image')
          .single();
        if (!error && data) {
          room.coverImage = (data as any).cover_image || publicUrl;
        } else {
          room.coverImage = publicUrl;
          console.log('[Cover Save] DB update failed, using local:', error?.message);
        }
      }

      // Cleanup & navigate
      setRoomName('');
      setRoomTopic('');
      setRoomEnvironment('generic');
      setCoverImageUri(null);
      setShowCreateModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push(`/(tabs)/live/room/${room.id}` as any);
    } catch (e: any) {
      console.log('[Create Room] failed:', e?.message || e);
    }
    setIsCreating(false);
    setIsUploadingCover(false);
  }, [roomName, roomTopic, coverImageUri, createRoom, uploadCoverImage, router]);

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
                {myRooms.length > 0
                  ? `${myRooms.length} room${myRooms.length > 1 ? 's' : ''}`
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

            {myRooms.length === 0 ? (
              <View style={styles.emptyState}>
                <Circle size={48} color={colors.accent + '30'} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  No rooms yet
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
                {myRooms.map((room) => (
                  <TouchableOpacity
                    key={room.id}
                    style={[
                      styles.roomCard,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                    activeOpacity={0.9}
                    onPress={() => handleJoinRoom(room)}
                  >
                    {/* Room cover image or status gradient */}
                    {room.coverImage ? (
                      <View style={styles.roomGradient}>
                        <Image
                          source={{ uri: room.coverImage }}
                          style={styles.roomCoverImg}
                        />
                        <View style={styles.roomLiveIndicator}>
                          <View style={[
                            styles.roomLiveDot,
                            room.status === 'draft' && { backgroundColor: '#FBBF24' },
                            room.status === 'ended' && { backgroundColor: '#9CA3AF' },
                          ]} />
                          <Text style={[
                            styles.roomLiveText,
                            room.status === 'draft' && { color: '#FBBF24' },
                            room.status === 'ended' && { color: '#D1D5DB' },
                          ]}>
                            {room.status === 'draft' ? 'SETUP' : room.status === 'ended' ? 'ENDED' : 'LIVE'}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <LinearGradient
                        colors={
                          room.status === 'ended' ? ['#6B7280', '#4B5563'] :
                          room.status === 'draft' ? ['#F59E0B', '#D97706'] :
                          ['#8B5CF6', '#6366F1']
                        }
                        style={styles.roomGradient}
                      >
                        <View style={styles.roomLiveIndicator}>
                          <View style={[
                            styles.roomLiveDot,
                            room.status === 'draft' && { backgroundColor: '#FBBF24' },
                            room.status === 'ended' && { backgroundColor: '#9CA3AF' },
                          ]} />
                          <Text style={[
                            styles.roomLiveText,
                            room.status === 'draft' && { color: '#FBBF24' },
                            room.status === 'ended' && { color: '#D1D5DB' },
                          ]}>
                            {room.status === 'draft' ? 'SETUP' : room.status === 'ended' ? 'ENDED' : 'LIVE'}
                          </Text>
                        </View>
                      </LinearGradient>
                    )}

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
                  {isCreating ? 'Creating...' : 'Create Room'}
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

              {/* ── Cover Image ── */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  Room Cover
                </Text>
                <TouchableOpacity
                  style={[styles.coverPicker, {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  }]}
                  onPress={pickCoverImage}
                  disabled={isUploadingCover}
                >
                  {coverImageUri ? (
                    <Image source={{ uri: coverImageUri }} style={styles.coverPreview} />
                  ) : (
                    <View style={styles.coverPlaceholder}>
                      <Camera size={28} color={colors.textTertiary} />
                      <Text style={[styles.coverPlaceholderText, { color: colors.textTertiary }]}>
                        Add cover image
                      </Text>
                      <Text style={[styles.coverHint, { color: colors.textTertiary }]}>
                        16:9 ratio recommended
                      </Text>
                    </View>
                  )}
                  {coverImageUri && (
                    <View style={styles.coverChangeOverlay}>
                      <ImageIcon size={16} color="#FFF" />
                      <Text style={styles.coverChangeText}>Change</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Virtual Room</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {ENVIRONMENT_OPTIONS.map((env) => {
                    const active = roomEnvironment === env.key;
                    return (
                      <TouchableOpacity
                        key={env.key}
                        style={[
                          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, marginBottom: 4 },
                          { backgroundColor: active ? colors.accent : colors.surface, borderColor: active ? colors.accent : colors.border },
                        ]}
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRoomEnvironment(env.key); }}
                      >
                        <Text style={{ fontSize: 16 }}>{env.emoji} </Text>
                        <Text style={[{ fontSize: 13, fontWeight: active ? '600' : '400' }, { color: active ? '#FFF' : colors.textSecondary }]}>{env.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Suggestions</Text>
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
                    colors={['#F59E0B', '#D97706']}
                    style={styles.previewGradient}
                  >
                    <View style={styles.previewLive}>
                      <View style={[styles.previewDot, { backgroundColor: '#FBBF24' }]} />
                      <Text style={[styles.previewLiveText, { color: '#FBBF24' }]}>SETUP</Text>
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
    overflow: 'hidden',
  },
  roomCoverImg: {
    ...StyleSheet.absoluteFillObject, width: '100%', height: '100%',
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

  // ── Cover Image ──
  coverPicker: {
    borderRadius: 12, borderWidth: 1, overflow: 'hidden',
    minHeight: 140,
  },
  coverPreview: {
    width: '100%', height: 160, resizeMode: 'cover',
  },
  coverPlaceholder: {
    height: 140, alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  coverPlaceholderText: {
    fontSize: 14, fontWeight: '600',
  },
  coverHint: {
    fontSize: 11,
  },
  coverChangeOverlay: {
    position: 'absolute', right: 10, bottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10,
    paddingVertical: 5, borderRadius: 12,
  },
  coverChangeText: {
    color: '#FFF', fontSize: 12, fontWeight: '600',
  },
});
