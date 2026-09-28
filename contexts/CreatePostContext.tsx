import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Alert, Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Camera, FileText, Gift, Wrench, X } from 'lucide-react-native';

import InstagramCamera, { type CapturedMedia } from '@/components/InstagramCamera';
import PostComposer from '@/components/PostComposer';
import CreateDealModal from '@/components/CreateDealModal';
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

  const [showCreate, setShowCreate] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showChooser, setShowChooser] = useState(false);
  const [showDeal, setShowDeal] = useState(false);
  const [dealMode, setDealMode] = useState<'skill' | 'bundle'>('skill');
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

  const startDeal = useCallback((mode: 'skill' | 'bundle') => {
    setShowChooser(false);
    setDealMode(mode);
    setShowDeal(true);
  }, []);

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
  }, [showTabBar]);

  const value = useMemo<CreatePostContextValue>(() => ({ openCreate }), [openCreate]);

  return (
    <CreatePostContext.Provider value={value}>
      {children}

      {/* Chooser — what do you want to create? */}
      <Modal visible={showChooser} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setShowChooser(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.chooserSheet, { backgroundColor: colors.background }]}>
            <View style={styles.chooserHeader}>
              <Text style={[styles.chooserTitle, { color: colors.text }]}>Create</Text>
              <TouchableOpacity onPress={() => setShowChooser(false)}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.chooserOption, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={startPhotoVideo}
              activeOpacity={0.8}
            >
              <View style={[styles.chooserIcon, { backgroundColor: colors.accentGlow }]}>
                <Camera size={22} color={colors.accent} />
              </View>
              <View style={styles.chooserTextWrap}>
                <Text style={[styles.chooserOptionTitle, { color: colors.text }]}>Post</Text>
                <Text style={[styles.chooserOptionSub, { color: colors.textSecondary }]}>Photo or video</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chooserOption, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={startTextPost}
              activeOpacity={0.8}
            >
              <View style={[styles.chooserIcon, { backgroundColor: colors.accentGlow }]}>
                <FileText size={22} color={colors.accent} />
              </View>
              <View style={styles.chooserTextWrap}>
                <Text style={[styles.chooserOptionTitle, { color: colors.text }]}>Text Post</Text>
                <Text style={[styles.chooserOptionSub, { color: colors.textSecondary }]}>Share a written update</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chooserOption, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => startDeal('bundle')}
              activeOpacity={0.8}
            >
              <View style={[styles.chooserIcon, { backgroundColor: colors.accentGlow }]}>
                <Gift size={22} color={colors.accent} />
              </View>
              <View style={styles.chooserTextWrap}>
                <Text style={[styles.chooserOptionTitle, { color: colors.text }]}>Create Bundle</Text>
                <Text style={[styles.chooserOptionSub, { color: colors.textSecondary }]}>Package multiple items</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chooserOption, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => startDeal('skill')}
              activeOpacity={0.8}
            >
              <View style={[styles.chooserIcon, { backgroundColor: colors.accentGlow }]}>
                <Wrench size={22} color={colors.accent} />
              </View>
              <View style={styles.chooserTextWrap}>
                <Text style={[styles.chooserOptionTitle, { color: colors.text }]}>Post Skill / Service</Text>
                <Text style={[styles.chooserOptionSub, { color: colors.textSecondary }]}>Offer a service you provide</Text>
              </View>
            </TouchableOpacity>
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

      <CreateDealModal
        visible={showDeal}
        mode={dealMode}
        onClose={() => setShowDeal(false)}
      />

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
    paddingTop: 16,
    paddingBottom: 28,
  },
  chooserHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  chooserTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  chooserOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  chooserIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chooserTextWrap: {
    flex: 1,
  },
  chooserOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  chooserOptionSub: {
    fontSize: 13,
    marginTop: 2,
  },
});
