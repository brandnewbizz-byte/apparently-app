import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Alert, Modal } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

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

  const [showCreate, setShowCreate] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
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

  const openCreate = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Create Post', '', [
      {
        text: 'Take Photo/Video',
        onPress: () => {
          hideTabBar();
          setShowCamera(true);
        },
      },
      {
        text: 'Write Text Post',
        onPress: () => {
          setCreatePreloadMedia(null);
          setCreatePreloadMediaWidth(undefined);
          setCreatePreloadMediaHeight(undefined);
          setShowCreate(true);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [hideTabBar]);

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
