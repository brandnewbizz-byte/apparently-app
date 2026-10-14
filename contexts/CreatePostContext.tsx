import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Alert, Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Camera, FileText, Gift, Wrench, CalendarDays, X, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import InstagramCamera, { type CapturedMedia } from '@/components/InstagramCamera';
import PostComposer from '@/components/PostComposer';
import { useAuth } from '@/contexts/AuthContext';
import { useSocial } from '@/contexts/SocialContext';
import { useUserPosts } from '@/contexts/UserPostsContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTabBar } from '@/contexts/TabBarContext';

interface CreatePostContextValue {
  openCreate: () => void;
}

const CreatePostContext = createContext<CreatePostContextValue | null>(null);

export function useCreatePost(): CreatePostContextValue {
  const ctx = useContext(CreatePostContext);
  if (!ctx) throw new Error('useCreatePost must be used within CreatePostProvider');
  return ctx;
}

export function CreatePostProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const { user: authUser } = useAuth();
  const { createPost } = useSocial();
  const { addUserPost } = useUserPosts();
  const { hideTabBar, showTabBar } = useTabBar();
  const router = useRouter();

  const [showCreate, setShowCreate] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showChooser, setShowChooser] = useState(false);
  const [createPreloadMedia, setCreatePreloadMedia] = useState<string | null>(null);
  const [createPreloadMediaWidth, setCreatePreloadMediaWidth] = useState<number | undefined>(undefined);
  const [createPreloadMediaHeight, setCreatePreloadMediaHeight] = useState<number | undefined>(undefined);
  const [createMediaType, setCreateMediaType] = useState<'photo' | 'video'>('photo');
  const [createCategory, setCreateCategory] = useState<string | null>(null);

  const handleCreatePost = useCallback((data: { caption: string; mediaUri?: string; mediaWidth?: number; mediaHeight?: number; category?: string }) => {
    const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const timestamp = new Date().toISOString();
    const isVideoPost = createMediaType === 'video';

    // Persist to SocialContext so posts appear in getAllPosts() and profile grid.
    try {
      createPost(data.caption, data.mediaUri, { mediaType: isVideoPost ? 'video' : 'image' });
    } catch (err: any) {
      console.warn('[CreatePost] createPost failed:', err?.message || err);
    }

    // Share to profile
    addUserPost({
      id,
      caption: data.caption,
      mediaUri: data.mediaUri,
      timestamp,
    });

    // Close modals
    setShowCreate(false);
    setCreatePreloadMedia(null);
    setCreateCategory(null);
  }, [createMediaType, createPost, addUserPost]);

  const startPhotoVideo = useCallback(() => {
    setShowChooser(false);
    hideTabBar();
    setShowCamera(true);
  }, [hideTabBar]);

  const startTextPost = useCallback(() => {
    setShowChooser(false);
    setCreatePreloadMedia(null);
    setCreatePreloadMediaWidth(undefined);
    setCreatePreloadMediaHeight(undefined);
    setShowCreate(true);
  }, []);

  const startBundle = useCallback(() => {
    setShowChooser(false);
    router.push('/bundle-builder' as any);
  }, [router]);

  const startSkill = useCallback(() => {
    setShowChooser(false);
    router.push('/skill-builder' as any);
  }, [router]);

  const startPlanner = useCallback(() => {
    setShowChooser(false);
    router.push('/(tabs)/planner' as any);
  }, [router]);

  const openCreate = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowChooser(true);
  }, []);

  const handleCameraCapture = useCallback((media: CapturedMedia) => {
    setCreatePreloadMedia(media.uri);
    setCreatePreloadMediaWidth(media.width);
    setCreatePreloadMediaHeight(media.height);
    setShowCamera(false);
    showTabBar();
    setShowCreate(true);
  }, [showTabBar]);

  const handlePickFromGallery = useCallback(async () => {
    const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!libPerm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
      allowsEditing: false,
      videoMaxDuration: 60,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setCreatePreloadMedia(asset.uri);
      setCreateMediaType(asset.type === 'video' ? 'video' : 'photo');
      if (asset.type === 'video' && asset.duration && asset.duration > 60000) {
        Alert.alert('Video too long', 'Please select a video under 60 seconds.');
        return;
      }
      setShowCamera(false);
      showTabBar();
      setShowCreate(true);
    }
  }, [showTabBar]);

  const handleCameraClose = useCallback(() => {
    setShowCamera(false);
    showTabBar();
    setShowChooser(true);
  }, [showTabBar]);

  const value = useMemo<CreatePostContextValue>(() => ({ openCreate }), [openCreate]);

  return (
    <CreatePostContext.Provider value={value}>
      {children}

      {/* Chooser — what do you want to create? */}
      <Modal visible={showChooser} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setShowChooser(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.chooserSheet, { backgroundColor: colors.background }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            <View style={styles.chooserHeader}>
              <Text style={[styles.chooserTitle, { color: colors.text }]}>Create</Text>
              <TouchableOpacity
                onPress={() => setShowChooser(false)}
                style={[styles.closeBtn, { backgroundColor: colors.surfaceHighlight }]}
                activeOpacity={0.8}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Primary: photo/video post */}
            <TouchableOpacity
              style={[styles.primaryCard, { backgroundColor: colors.accent }]}
              onPress={startPhotoVideo}
              activeOpacity={0.85}
            >
              <View style={styles.primaryIcon}>
                <Camera size={26} color="#FFFFFF" />
              </View>
              <View style={styles.primaryText}>
                <Text style={styles.primaryTitle}>Post</Text>
                <Text style={styles.primarySub}>Photo or video</Text>
              </View>
              <ChevronRight size={22} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>

            {/* Secondary grid */}
            <View style={styles.grid}>
              <TouchableOpacity
                style={[styles.gridTile, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={startTextPost}
                activeOpacity={0.8}
              >
                <View style={[styles.gridTileIcon, { backgroundColor: colors.accentGlow }]}>
                  <FileText size={22} color={colors.accent} />
                </View>
                <Text style={[styles.gridTileTitle, { color: colors.text }]}>Text Post</Text>
                <Text style={[styles.gridTileSub, { color: colors.textSecondary }]}>Written update</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.gridTile, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={startBundle}
                activeOpacity={0.8}
              >
                <View style={[styles.gridTileIcon, { backgroundColor: colors.accentGlow }]}>
                  <Gift size={22} color={colors.accent} />
                </View>
                <Text style={[styles.gridTileTitle, { color: colors.text }]}>Create Bundle</Text>
                <Text style={[styles.gridTileSub, { color: colors.textSecondary }]}>Package items</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.gridTile, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={startSkill}
                activeOpacity={0.8}
              >
                <View style={[styles.gridTileIcon, { backgroundColor: colors.accentGlow }]}>
                  <Wrench size={22} color={colors.accent} />
                </View>
                <Text style={[styles.gridTileTitle, { color: colors.text }]}>Skill / Service</Text>
                <Text style={[styles.gridTileSub, { color: colors.textSecondary }]}>Offer a service</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.gridTile, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={startPlanner}
                activeOpacity={0.8}
              >
                <View style={[styles.gridTileIcon, { backgroundColor: colors.accentGlow }]}>
                  <CalendarDays size={22} color={colors.accent} />
                </View>
                <Text style={[styles.gridTileTitle, { color: colors.text }]}>Planner</Text>
                <Text style={[styles.gridTileSub, { color: colors.textSecondary }]}>Plan your day</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showCamera} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent>
        <InstagramCamera
          visible={showCamera}
          onClose={handleCameraClose}
          onCapture={handleCameraCapture}
          onPickFromGallery={handlePickFromGallery}
        />
      </Modal>

      <PostComposer
        visible={showCreate}
        onClose={() => { setShowCreate(false); setCreatePreloadMedia(null); }}
        onPost={handleCreatePost}
        preloadMediaUri={createPreloadMedia}
        preloadMediaWidth={createPreloadMediaWidth}
        preloadMediaHeight={createPreloadMediaHeight}
        backgroundColor={colors.background}
        textColor={colors.text}
        accentColor={colors.accent}
      />
    </CreatePostContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  chooserSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
    opacity: 0.4,
  },
  chooserHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chooserTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 16,
  },
  primaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    flex: 1,
  },
  primaryTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  primarySub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridTile: {
    width: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  gridTileIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  gridTileTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  gridTileSub: {
    fontSize: 12,
    lineHeight: 16,
  },
});
