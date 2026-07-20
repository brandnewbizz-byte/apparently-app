import { Bookmark, Camera, Heart, ImagePlus, MessageCircle, MoreHorizontal, Send, Share2, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { SocialComment, useSocial } from '@/contexts/SocialContext';
import { useTabBar } from '@/contexts/TabBarContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Post, Story, mockPosts, mockStories, mockUsers } from '@/mocks/data';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FEED_MEDIA_WIDTH = SCREEN_WIDTH - 24;
const INSTAGRAM_PHOTO_HEIGHT = Math.round(FEED_MEDIA_WIDTH * 1.25);
const INSTAGRAM_REEL_HEIGHT = Math.min(Math.round(FEED_MEDIA_WIDTH * (16 / 9)), Math.round(SCREEN_HEIGHT * 0.82));
const DOUBLE_TAP_DELAY = 220;

type FeedItem = Post & {
  imageWidth?: number;
  imageHeight?: number;
  imageAspectRatio?: number;
  renderFullImage?: boolean;
  isStory?: boolean;
  category?: string;
  postKind?: 'post' | 'sell';
};

type SelectedImageState = {
  uri: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
};

type ComposerMeta = {
  category?: string;
  postKind: 'post' | 'sell';
};

const HOME_CATEGORY_OPTIONS = [
  'Wellness',
  'Fitness',
  'Entertainment',
  'Creative',
  'Dining',
  'Travel',
] as const;

const viewer = {
  id: 'local-viewer',
  name: 'You',
  username: 'you',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160&h=160&fit=crop',
  isVerified: false,
  followersCount: 0,
};

const seededCommentLines = [
  'This looks so good 🔥',
  'Love this post.',
  'Need more of this on my feed.',
  'This is clean.',
  'Okayyy this one hit.',
  'Really like this vibe.',
];

function buildSeededComments(post: Post): SocialComment[] {
  if (post.comments <= 0 || post.id.startsWith('local-')) return [];
  return mockUsers
    .filter((user) => user.id !== post.user.id)
    .slice(0, Math.min(post.comments, 3))
    .map((user, index) => ({
      id: `seed-${post.id}-${user.id}`,
      authorId: user.id,
      authorName: user.name,
      authorAvatar: user.avatar,
      text: seededCommentLines[(Number(post.id || '0') + index) % seededCommentLines.length],
      timestamp: index === 0 ? '2m' : index === 1 ? '14m' : '31m',
      likes: 0,
      isLiked: false,
      replies: [],
    }));
}

function isReelStyle(post: Post) {
  const candidate = post as Post & { mediaType?: string; videoUrl?: string; isVideo?: boolean };
  return Boolean(candidate.videoUrl || candidate.isVideo || candidate.mediaType === 'video' || candidate.mediaType === 'reel');
}

function shouldRenderFullImage(post: FeedItem) {
  return Boolean(
    post.renderFullImage ||
    post.imageUrl?.startsWith('data:') ||
    post.imageUrl?.startsWith('file:')
  );
}

function getFeedMediaHeight(post: FeedItem) {
  if (isReelStyle(post)) return INSTAGRAM_REEL_HEIGHT;
  if (shouldRenderFullImage(post) && post.imageAspectRatio && post.imageAspectRatio > 0) {
    const rawHeight = FEED_MEDIA_WIDTH / post.imageAspectRatio;
    return Math.round(Math.min(Math.max(rawHeight, 220), SCREEN_HEIGHT * 0.74));
  }
  return INSTAGRAM_PHOTO_HEIGHT;
}

function toStoredImage(asset: ImagePicker.ImagePickerAsset): SelectedImageState {
  const mimeType = asset.mimeType || 'image/jpeg';
  const uri = asset.base64 ? `data:${mimeType};base64,${asset.base64}` : asset.uri;
  const aspectRatio = asset.width && asset.height ? asset.width / asset.height : undefined;
  return {
    uri,
    width: asset.width,
    height: asset.height,
    aspectRatio,
  };
}

function timeAgoLabel(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return 'Just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Story Bubble ────────────────────────────────────────────────────────────

function StoryBubble({ story, colors }: { story: Story; colors: any }) {
  return (
    <TouchableOpacity activeOpacity={0.88} style={styles.storyBubble}>
      <View style={[styles.storyRing, { borderColor: story.viewed ? colors.border : colors.accent }]}>
        <Image source={{ uri: story.user.avatar }} style={styles.storyAvatar} />
      </View>
      <Text style={[styles.storyLabel, { color: colors.textSecondary }]} numberOfLines={1}>
        {story.user.username}
      </Text>
    </TouchableOpacity>
  );
}

// ── Comments Sheet ──────────────────────────────────────────────────────────

function CommentsSheet({
  visible, colors, post, comments, commentCount,
  draft, autoFocus, onChangeDraft, onClose, onSubmit,
}: {
  visible: boolean; colors: any; post: Post | null; comments: SocialComment[];
  commentCount: number; draft: string; autoFocus: boolean;
  onChangeDraft: (text: string) => void; onClose: () => void; onSubmit: () => void;
}) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput | null>(null);
  useEffect(() => {
    if (!visible || !autoFocus) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 280);
    return () => clearTimeout(timer);
  }, [visible, autoFocus]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
          style={styles.sheetKeyboardWrap}
        >
        <View style={[styles.sheetCard, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Comments</Text>
            <Text style={[styles.sheetMeta, { color: colors.textSecondary }]}>{commentCount} total</Text>
            <TouchableOpacity onPress={onClose} style={styles.sheetCloseButton}>
              <X size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
          {post ? (
            <View style={[styles.sheetPostPreview, { borderBottomColor: colors.borderLight || colors.border }]}>
              <Image source={{ uri: post.user.avatar }} style={styles.sheetPostAvatar} />
              <View style={styles.sheetPostTextWrap}>
                <Text style={[styles.sheetPostUser, { color: colors.text }]}>{post.user.name}</Text>
                <Text style={[styles.sheetPostCaption, { color: colors.textSecondary }]} numberOfLines={2}>
                  {post.content}
                </Text>
              </View>
            </View>
          ) : null}
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            contentContainerStyle={styles.sheetCommentsContent}
            ListEmptyComponent={
              <View style={styles.sheetEmptyWrap}>
                <Text style={[styles.sheetEmptyTitle, { color: colors.text }]}>No comments yet</Text>
                <Text style={[styles.sheetEmptyText, { color: colors.textSecondary }]}>Start the conversation.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.sheetCommentRow}>
                <Image source={{ uri: item.authorAvatar }} style={styles.sheetCommentAvatar} />
                <View style={styles.sheetCommentBody}>
                  <Text style={styles.sheetCommentLine}>
                    <Text style={[styles.sheetCommentAuthor, { color: colors.text }]}>{item.authorName}</Text>
                    <Text style={[styles.sheetCommentText, { color: colors.textSecondary }]}> {item.text}</Text>
                  </Text>
                  <Text style={[styles.sheetCommentTime, { color: colors.textTertiary }]}>{item.timestamp}</Text>
                </View>
              </View>
            )}
          />
          <View style={[styles.sheetComposer, { borderTopColor: colors.border }]}>
            <Image source={{ uri: viewer.avatar }} style={styles.sheetComposerAvatar} />
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={onChangeDraft}
              placeholder="Add a comment..."
              placeholderTextColor={colors.textTertiary}
              style={[styles.sheetInput, { backgroundColor: colors.backgroundSecondary, color: colors.text }]}
              returnKeyType="send"
              onSubmitEditing={onSubmit}
              autoFocus={autoFocus}
            />
            <TouchableOpacity onPress={onSubmit} style={styles.sheetSendButton}>
              <Text style={[styles.sheetSendText, { color: colors.accent }]}>Post</Text>
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Full-Screen Media Viewer ────────────────────────────────────────────────

function MediaViewer({
  visible, post, liked, saved, likeCount, flashHeart,
  onClose, onDoubleTapLike, onToggleLike, onToggleSave, onOpenComments, onShowMore,
}: {
  visible: boolean; post: Post | null; liked: boolean; saved: boolean;
  likeCount: number; flashHeart: boolean;
  onClose: () => void; onDoubleTapLike: () => void;
  onToggleLike: () => void; onToggleSave: () => void; onOpenComments: () => void;
  onShowMore: () => void;
}) {
  const insets = useSafeAreaInsets();
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleImageTap = useCallback(() => {
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = null;
      onDoubleTapLike();
      return;
    }
    tapTimeoutRef.current = setTimeout(() => {
      tapTimeoutRef.current = null;
    }, DOUBLE_TAP_DELAY);
  }, [onDoubleTapLike]);

  useEffect(() => {
    if (visible && Platform.OS === 'ios') StatusBar.setHidden(true, 'fade');
    return () => { if (Platform.OS === 'ios') StatusBar.setHidden(false, 'fade'); };
  }, [visible]);

  if (!post || !post.imageUrl) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <View style={styles.viewerContainer}>
        <View style={[styles.viewerTopBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} style={styles.viewerCloseButton}>
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.viewerTopUser}>
            <Image source={{ uri: post.user.avatar }} style={styles.viewerTopAvatar} />
            <Text style={styles.viewerTopUsername}>{post.user.username}</Text>
          </View>
          <TouchableOpacity onPress={onShowMore} style={styles.viewerMoreButton}>
            <MoreHorizontal size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <Pressable onPress={handleImageTap} style={styles.viewerMediaArea}>
          <Image
            source={{ uri: post.imageUrl }}
            style={styles.viewerImage}
            resizeMode="contain"
          />
          {flashHeart ? (
            <View style={styles.viewerHeartFlash} pointerEvents="none">
              <Heart size={100} color="#FFFFFF" fill="#FFFFFF" />
            </View>
          ) : null}
        </Pressable>

        <View style={[styles.viewerBottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.viewerActionRow}>
            <View style={styles.viewerActionLeft}>
              <TouchableOpacity onPress={onToggleLike} style={styles.viewerActionButton}>
                <Heart size={28} color={liked ? '#ED4956' : '#FFFFFF'} fill={liked ? '#ED4956' : 'none'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onOpenComments} style={styles.viewerActionButton}>
                <MessageCircle size={27} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.viewerActionButton}>
                <Send size={25} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={onToggleSave} style={styles.viewerActionButton}>
              <Bookmark size={26} color="#FFFFFF" fill={saved ? '#FFFFFF' : 'none'} />
            </TouchableOpacity>
          </View>
          <Text style={styles.viewerLikes}>{likeCount.toLocaleString()} likes</Text>
          <Text style={styles.viewerCaption} numberOfLines={4}>
            <Text style={styles.viewerCaptionUser}>{post.user.username}</Text>
            <Text style={styles.viewerCaptionText}>{' '}{post.content}</Text>
          </Text>
          <Text style={styles.viewerTimestamp}>{post.timestamp}</Text>
        </View>
      </View>
    </Modal>
  );
}

// ── Post More Options Sheet (Three-Dot Menu) ────────────────────────────────

function PostMoreSheet({
  visible, post, colors, onClose, onReport,
}: {
  visible: boolean; post: Post | null; colors: any;
  onClose: () => void; onReport: () => void;
}) {
  if (!post) return null;
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.moreOverlay} onPress={onClose}>
        <View style={[styles.moreBottomSheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.moreTitle, { color: colors.text }]}>Options</Text>
          <TouchableOpacity
            style={[styles.moreOption, { borderTopColor: colors.border }]}
            onPress={() => { onClose(); setTimeout(onReport, 300); }}
          >
            <Text style={[styles.moreOptionText, { color: '#ED4956' }]}>Report</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.moreOption, { borderTopColor: colors.border }]}
            onPress={() => {
              onClose();
              Alert.alert('Shared!', 'Post link copied to clipboard.');
            }}
          >
            <Text style={[styles.moreOptionText, { color: colors.text }]}>Copy Link</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.moreOption, { borderTopColor: colors.border }]}
            onPress={() => {
              onClose();
              Alert.alert('Saved', 'Post has been saved to your collection.');
            }}
          >
            <Text style={[styles.moreOptionText, { color: colors.text }]}>Save to Collection</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.moreOption, { borderTopColor: colors.border }]}
            onPress={() => {
              onClose();
              Alert.alert('Muted', 'You won\'t see posts from this user anymore.');
            }}
          >
            <Text style={[styles.moreOptionText, { color: colors.text }]}>Mute User</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.moreOption, { borderTopColor: colors.border }]}
            onPress={() => {
              onClose();
              Alert.alert('Blocked', 'This user has been blocked.');
            }}
          >
            <Text style={[styles.moreOptionText, { color: colors.text }]}>Block User</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.moreCancel, { borderTopColor: colors.border }]} onPress={onClose}>
            <Text style={[styles.moreCancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

// ── Create Post Modal (Gallery / Camera / Story) ────────────────────────────

type PostMode = 'feed' | 'story';

function CreatePostModal({
  visible, colors, onClose, onPublish,
}: {
  visible: boolean; colors: any; onClose: () => void;
  onPublish: (content: string, image: SelectedImageState | undefined, postMode: PostMode, meta: ComposerMeta) => void;
}) {
  const insets = useSafeAreaInsets();
  const [selectedImage, setSelectedImage] = useState<SelectedImageState | null>(null);
  const [caption, setCaption] = useState('');
  const [postMode, setPostMode] = useState<PostMode>('feed');
  const [postKind, setPostKind] = useState<'post' | 'sell'>('post');
  const [selectedCategory, setSelectedCategory] = useState<string>('Wellness');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSelectedImage(null);
      setCaption('');
      setPostMode('feed');
      setPostKind('post');
      setSelectedCategory('Wellness');
      setIsUploading(false);
    }
  }, [visible]);

  const pickFromGallery = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow access to your photo library in Settings.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      base64: true,
      quality: 0.9,
    });
    if (!result.canceled && result.assets?.[0]) setSelectedImage(toStoredImage(result.assets[0]));
  }, []);

  const takePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow camera access in Settings.'); return; }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      base64: true,
      quality: 0.9,
    });
    if (!result.canceled && result.assets?.[0]) setSelectedImage(toStoredImage(result.assets[0]));
  }, []);

  const handlePublish = useCallback(() => {
    if (!caption.trim() && !selectedImage) return;
    setIsUploading(true);
    setTimeout(() => {
      onPublish(caption.trim(), selectedImage ?? undefined, postMode, {
        postKind,
        category: selectedCategory,
      });
      onClose();
    }, 400);
  }, [caption, selectedImage, postMode, postKind, selectedCategory, onPublish, onClose]);

  const canPublish = caption.trim().length > 0 || Boolean(selectedImage);

  const renderBottomToolbar = () => (
    <View style={[styles.createToolbar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={[styles.createToolbarRow, { borderTopColor: colors.border }]}>
        {/* Gallery */}
        <TouchableOpacity style={styles.createTool} onPress={pickFromGallery}>
          <View style={[styles.createToolIcon, { backgroundColor: '#FF8500' }]}>
            <ImagePlus size={22} color="#FFF" />
          </View>
          <Text style={[styles.createToolLabel, { color: colors.textSecondary }]}>Gallery</Text>
        </TouchableOpacity>

        {/* Camera */}
        <TouchableOpacity style={styles.createTool} onPress={takePhoto}>
          <View style={[styles.createToolIcon, { backgroundColor: '#5856D6' }]}>
            <Camera size={22} color="#FFF" />
          </View>
          <Text style={[styles.createToolLabel, { color: colors.textSecondary }]}>Camera</Text>
        </TouchableOpacity>

        {/* Post Type Toggle */}
        <TouchableOpacity
          style={styles.createTool}
          onPress={() => setPostMode((m) => (m === 'feed' ? 'story' : 'feed'))}
        >
          <View style={[styles.createToolIcon, { backgroundColor: postMode === 'story' ? '#34C759' : colors.accent }]}>
            <Text style={styles.createModeIcon}>
              {postMode === 'feed' ? '📰' : '📖'}
            </Text>
          </View>
          <Text style={[styles.createToolLabel, { color: colors.textSecondary }]}>
            {postMode === 'story' ? 'Story' : 'Feed'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.createModeHint, { backgroundColor: postMode === 'story' ? 'rgba(52,199,89,0.1)' : 'rgba(0,122,255,0.1)' }]}>
        <Text style={[styles.createModeHintText, { color: postMode === 'story' ? '#34C759' : colors.accent }]}>
          {postMode === 'story'
            ? '📖 Story — disappears after 24 hours'
            : '📰 Feed Post — stays on your profile'}
        </Text>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.createContainer, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.createHeader, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <X size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.createTitle, { color: colors.text }]}>
            {postMode === 'story' ? 'New Story' : 'New Post'}
          </Text>
          <TouchableOpacity
            onPress={handlePublish}
            disabled={!canPublish || isUploading}
            style={[styles.createShareBtn, { backgroundColor: canPublish ? colors.accent : colors.border }]}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.createShareText}>Share</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Content Area */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.createContent}
        >
          <ScrollView contentContainerStyle={styles.createScrollContent} keyboardShouldPersistTaps="handled">
            {selectedImage ? (
              <View style={styles.createImagePreviewWrap}>
                <Image
                  source={{ uri: selectedImage.uri }}
                  style={[
                    styles.createImagePreview,
                    postMode === 'story'
                      ? { aspectRatio: 9 / 16, maxHeight: SCREEN_HEIGHT * 0.55 }
                      : {
                          aspectRatio: selectedImage.aspectRatio || 1,
                          maxHeight: SCREEN_HEIGHT * 0.55,
                          minHeight: 220,
                        },
                  ]}
                  resizeMode="contain"
                />
                <TouchableOpacity style={styles.createRemoveImage} onPress={() => setSelectedImage(null)}>
                  <X size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.createPlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
                <Text style={[styles.createPlaceholderIcon]}>📸</Text>
                <Text style={[styles.createPlaceholderText, { color: colors.textSecondary }]}>
                  Choose a photo or take one
                </Text>
              </View>
            )}

            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Write a caption..."
              placeholderTextColor={colors.textTertiary}
              style={[styles.createCaptionInput, { color: colors.text }]}
              multiline
              maxLength={2200}
              textAlignVertical="top"
            />

            <View style={styles.composerMetaSection}>
              <Text style={[styles.composerMetaLabel, { color: colors.text }]}>Post type</Text>
              <View style={styles.composerMetaRow}>
                {(['post', 'sell'] as const).map((kind) => {
                  const active = postKind === kind;
                  return (
                    <TouchableOpacity
                      key={kind}
                      onPress={() => setPostKind(kind)}
                      style={[
                        styles.composerMetaChip,
                        {
                          backgroundColor: active ? colors.accent : colors.backgroundSecondary,
                          borderColor: active ? colors.accent : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.composerMetaChipText, { color: active ? '#FFFFFF' : colors.text }]}>
                        {kind === 'sell' ? 'Selling' : 'Just Posting'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.composerMetaSection}>
              <Text style={[styles.composerMetaLabel, { color: colors.text }]}>Category</Text>
              <View style={styles.categoryChipWrap}>
                {HOME_CATEGORY_OPTIONS.map((category) => {
                  const active = selectedCategory === category;
                  return (
                    <TouchableOpacity
                      key={category}
                      onPress={() => setSelectedCategory(category)}
                      style={[
                        styles.categoryChip,
                        {
                          backgroundColor: active ? colors.accent : colors.backgroundSecondary,
                          borderColor: active ? colors.accent : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.categoryChipText, { color: active ? '#FFFFFF' : colors.text }]}>{category}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {renderBottomToolbar()}
      </View>
    </Modal>
  );
}

// ── Feed Post Card ──────────────────────────────────────────────────────────

function FeedPost({
  post, colors, liked, saved, likeCount, commentCount, comments, flashHeart,
  onToggleLike, onQuickLike, onOpenComments, onToggleSave, onShare, onMediaTap, onShowMore,
}: {
  post: FeedItem; colors: any; liked: boolean; saved: boolean;
  likeCount: number; commentCount: number; comments: SocialComment[]; flashHeart: boolean;
  onToggleLike: () => void; onQuickLike: () => void; onOpenComments: () => void;
  onToggleSave: () => void; onShare: () => void; onMediaTap: () => void;
  onShowMore: () => void;
}) {
  const hasMedia = Boolean(post.imageUrl);
  const [resolvedAspectRatio, setResolvedAspectRatio] = useState<number | null>(post.imageAspectRatio ?? null);
  const preserveFullImage = shouldRenderFullImage(post);
  const effectivePost = useMemo(() => (
    resolvedAspectRatio ? { ...post, imageAspectRatio: resolvedAspectRatio } : post
  ), [post, resolvedAspectRatio]);
  const mediaHeight = getFeedMediaHeight(effectivePost);
  const reelStyle = isReelStyle(post);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!post.imageUrl || post.imageAspectRatio) {
      setResolvedAspectRatio(post.imageAspectRatio ?? null);
      return;
    }
    let cancelled = false;
    Image.getSize(
      post.imageUrl,
      (width, height) => {
        if (!cancelled && width > 0 && height > 0) setResolvedAspectRatio(width / height);
      },
      () => {
        if (!cancelled) setResolvedAspectRatio(null);
      }
    );
    return () => { cancelled = true; };
  }, [post.imageAspectRatio, post.imageUrl]);

  const handleMediaTap = useCallback(() => {
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = null;
      onQuickLike();
      return;
    }
    tapTimeoutRef.current = setTimeout(() => {
      tapTimeoutRef.current = null;
      onMediaTap();
    }, DOUBLE_TAP_DELAY);
  }, [onQuickLike, onMediaTap]);

  const previewComments = comments.slice(0, 2);

  return (
    <View style={[styles.postCard, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight || colors.border }]}>
      <View style={styles.postHeader}>
        <View style={styles.postHeaderLeft}>
          <Image source={{ uri: post.user.avatar }} style={styles.postAvatar} />
          <View>
            <Text style={[styles.postUser, { color: colors.text }]}>{post.user.username}</Text>
            <Text style={[styles.postTime, { color: colors.textSecondary }]}>{post.timestamp}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onShowMore} style={styles.postMoreButton}>
          <MoreHorizontal size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {hasMedia ? (
        <Pressable onPress={handleMediaTap} style={[
          styles.mediaWrap,
          reelStyle && styles.reelMediaWrap,
          preserveFullImage && styles.fullImageWrap,
        ]}>
          <Image
            source={{ uri: post.imageUrl }}
            style={[styles.postMedia, { height: mediaHeight }]}
            resizeMode={preserveFullImage ? 'contain' : 'cover'}
          />
          {flashHeart ? (
            <View style={styles.heartFlashWrap} pointerEvents="none">
              <Heart size={84} color="#FFFFFF" fill="#FFFFFF" />
            </View>
          ) : null}
        </Pressable>
      ) : (
        <Pressable
          onPress={handleMediaTap}
          style={[styles.textOnlyCard, { backgroundColor: colors.backgroundSecondary }]}
        >
          <Text style={[styles.textOnlyCopy, { color: colors.text }]}>{post.content}</Text>
          {flashHeart ? (
            <View style={styles.heartFlashWrap} pointerEvents="none">
              <Heart size={84} color="#FFFFFF" fill="#FFFFFF" />
            </View>
          ) : null}
        </Pressable>
      )}

      <View style={styles.postActionsRow}>
        <View style={styles.postActionsLeft}>
          <TouchableOpacity onPress={onToggleLike} style={styles.iconButton}>
            <Heart size={24} color={liked ? '#ED4956' : colors.text} fill={liked ? '#ED4956' : 'none'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onOpenComments} style={styles.iconButton}>
            <MessageCircle size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onShare} style={styles.iconButton}>
            <Send size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={onToggleSave} style={styles.iconButton}>
          <Bookmark size={23} color={colors.text} fill={saved ? colors.text : 'none'} />
        </TouchableOpacity>
      </View>

      <View style={styles.postMetaBlock}>
        {post.postKind === 'sell' ? (
          <View style={styles.postBadgeRow}>
            <View style={[styles.postBadge, styles.postBadgeSell]}>
              <Text style={styles.postBadgeSellText}>SELLING</Text>
            </View>
          </View>
        ) : null}
        <Text style={[styles.likesText, { color: colors.text }]}>{likeCount.toLocaleString()} likes</Text>
        <Text style={[styles.captionLine, { color: colors.text }]} numberOfLines={3}>
          <Text style={styles.captionUser}>{post.user.username}</Text>
          <Text>{' '}{post.content}</Text>
        </Text>
        <TouchableOpacity onPress={onOpenComments} activeOpacity={0.78} style={styles.commentPreviewTouch}>
          {commentCount > 0 ? (
            <Text style={[styles.viewCommentsText, { color: colors.textSecondary }]}>View all {commentCount} comments</Text>
          ) : (
            <Text style={[styles.viewCommentsText, { color: colors.textSecondary }]}>Add a comment...</Text>
          )}
          {previewComments.map((comment) => (
            <Text key={comment.id} style={[styles.previewCommentLine, { color: colors.text }]} numberOfLines={1}>
              <Text style={styles.previewCommentAuthor}>{comment.authorName}</Text>
              <Text style={{ color: colors.textSecondary }}>{' '}{comment.text}</Text>
            </Text>
          ))}
        </TouchableOpacity>
        <Text style={[styles.postTimeFooter, { color: colors.textTertiary }]}>{post.timestamp}</Text>
      </View>
    </View>
  );
}

// ── Main Feed Screen ────────────────────────────────────────────────────────

export default function FeedScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { hideTabBar, showTabBar } = useTabBar();
  const { getAllPosts, getAllStories, createPost, createStory, getComments, addComment, sharePost } = useSocial();

  const [draft, setDraft] = useState('');
  const [localPosts, setLocalPosts] = useState<FeedItem[]>([]);
  const [localStories, setLocalStories] = useState<Story[]>([]);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [heartFlashPostId, setHeartFlashPostId] = useState<string | null>(null);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [autoFocusComments, setAutoFocusComments] = useState(false);
  const [viewerPostId, setViewerPostId] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [morePostId, setMorePostId] = useState<string | null>(null);
  const lastOffsetRef = useRef(0);

  const socialPosts = getAllPosts() as FeedItem[];
  const socialStories = getAllStories();
  const basePosts = (socialPosts.length ? socialPosts : mockPosts) as FeedItem[];
  const stories = useMemo(() => [...localStories, ...(socialStories.length ? socialStories : mockStories)].slice(0, 10), [localStories, socialStories]);
  const posts = useMemo(() => [...localPosts, ...basePosts], [localPosts, basePosts]);
  const activeCommentPost = useMemo(() => posts.find((p) => p.id === commentsPostId) ?? null, [posts, commentsPostId]);
  const activeViewerPost = useMemo(() => posts.find((p) => p.id === viewerPostId) ?? null, [posts, viewerPostId]);
  const activeMorePost = useMemo(() => posts.find((p) => p.id === morePostId) ?? null, [posts, morePostId]);

  const impact = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(style);
  };

  const getLikeCount = useCallback((p: Post) => likeCounts[p.id] ?? p.likes, [likeCounts]);
  const getDisplayComments = useCallback((p: Post) => [...getComments(p.id), ...buildSeededComments(p)], [getComments]);
  const getCommentCount = useCallback((p: Post) => p.comments + getComments(p.id).length, [getComments]);

  const flashHeart = useCallback((postId: string) => {
    setHeartFlashPostId(postId);
    setTimeout(() => setHeartFlashPostId((c) => (c === postId ? null : c)), 650);
  }, []);

  // ── Publish from composer ──
  const handleComposerPublish = useCallback((
    content: string,
    image: SelectedImageState | undefined,
    postMode: 'feed' | 'story',
    meta: ComposerMeta,
  ) => {
    if (postMode === 'story') {
      if (image?.uri) {
        setLocalStories((prev) => [{
          id: `local-story-${Date.now()}`,
          user: viewer,
          imageUrl: image.uri,
          timestamp: 'Just now',
          viewed: false,
        }, ...prev]);
        createStory(image.uri, undefined, content || undefined);
      }
      impact(Haptics.ImpactFeedbackStyle.Heavy);
      return;
    }

    setLocalPosts((prev) => [{
      id: `local-${Date.now()}`,
      user: viewer,
      content,
      imageUrl: image?.uri,
      imageWidth: image?.width,
      imageHeight: image?.height,
      imageAspectRatio: image?.aspectRatio,
      renderFullImage: Boolean(image?.uri),
      category: meta.category,
      postKind: meta.postKind,
      timestamp: 'Just now',
      likes: 0,
      comments: 0,
      shares: 0,
    }, ...prev]);
    setDraft('');
    createPost(content, image?.uri, { postKind: meta.postKind, category: meta.category });
    impact(Haptics.ImpactFeedbackStyle.Heavy);
  }, [createPost, createStory]);

  // ── Legacy text-only publish ──
  const handleLegacyPublish = useCallback(() => {
    const clean = draft.trim();
    if (!clean) return;
    setLocalPosts((prev) => [{
      id: `local-${Date.now()}`, user: viewer, content: clean,
      timestamp: 'Just now', likes: 0, comments: 0, shares: 0,
    }, ...prev]);
    setDraft('');
    createPost(clean);
    impact(Haptics.ImpactFeedbackStyle.Medium);
  }, [createPost, draft]);

  const handleScroll = useCallback((event: any) => {
    const offset = event.nativeEvent.contentOffset.y;
    if (offset > lastOffsetRef.current && offset > 40) hideTabBar();
    else if (offset < lastOffsetRef.current) showTabBar();
    lastOffsetRef.current = offset;
  }, [hideTabBar, showTabBar]);

  const toggleLike = useCallback((p: Post) => {
    const next = !likedMap[p.id];
    setLikedMap((prev) => ({ ...prev, [p.id]: next }));
    setLikeCounts((prev) => ({ ...prev, [p.id]: (prev[p.id] ?? p.likes) + (next ? 1 : -1) }));
    impact();
  }, [likedMap]);

  const quickLike = useCallback((p: Post) => {
    if (!likedMap[p.id]) {
      setLikedMap((prev) => ({ ...prev, [p.id]: true }));
      setLikeCounts((prev) => ({ ...prev, [p.id]: (prev[p.id] ?? p.likes) + 1 }));
    }
    flashHeart(p.id);
    impact(Haptics.ImpactFeedbackStyle.Medium);
  }, [flashHeart, likedMap]);

  const toggleSave = useCallback((postId: string) => {
    setSavedMap((prev) => ({ ...prev, [postId]: !prev[postId] }));
    impact();
  }, []);

  const openComments = useCallback((postId: string, autoFocus = false) => {
    setCommentsPostId(postId);
    setAutoFocusComments(autoFocus);
    impact(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const closeComments = useCallback(() => {
    setCommentsPostId(null);
    setAutoFocusComments(false);
  }, []);

  const submitComment = useCallback(() => {
    if (!activeCommentPost) return;
    const value = (commentDrafts[activeCommentPost.id] ?? '').trim();
    if (!value) return;
    addComment(activeCommentPost.id, value);
    setCommentDrafts((prev) => ({ ...prev, [activeCommentPost.id]: '' }));
    setAutoFocusComments(true);
    impact(Haptics.ImpactFeedbackStyle.Medium);
  }, [activeCommentPost, addComment, commentDrafts]);

  // ── Viewer ──
  const openViewer = useCallback((postId: string) => {
    setViewerPostId(postId);
    impact(Haptics.ImpactFeedbackStyle.Light);
  }, []);
  const closeViewer = useCallback(() => setViewerPostId(null), []);

  const viewerQuickLike = useCallback(() => {
    if (!activeViewerPost) return;
    if (!likedMap[activeViewerPost.id]) {
      setLikedMap((prev) => ({ ...prev, [activeViewerPost.id]: true }));
      setLikeCounts((prev) => ({ ...prev, [activeViewerPost.id]: (prev[activeViewerPost.id] ?? activeViewerPost.likes) + 1 }));
    }
    flashHeart(activeViewerPost.id);
    impact(Haptics.ImpactFeedbackStyle.Medium);
  }, [activeViewerPost, flashHeart, likedMap]);

  const viewerOpenComments = useCallback(() => {
    if (!activeViewerPost) return;
    setCommentsPostId(activeViewerPost.id);
    setAutoFocusComments(true);
    impact(Haptics.ImpactFeedbackStyle.Light);
  }, [activeViewerPost]);

  // ── More Options ──
  const openMore = useCallback((postId: string) => setMorePostId(postId), []);
  const closeMore = useCallback(() => setMorePostId(null), []);

  const handleReport = useCallback(() => {
    Alert.alert(
      'Report Post',
      'Are you sure you want to report this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Report', style: 'destructive', onPress: () => Alert.alert('Reported', 'Thank you. We\'ll review this post.') },
      ]
    );
  }, []);

  const openInbox = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push('/inbox' as any);
  }, [router]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}> 
        <Text style={[styles.headerTitle, { color: colors.text }]}>Feed</Text>
        <TouchableOpacity
          style={[styles.headerIconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={openInbox}
          activeOpacity={0.8}
        >
          <MessageCircle size={20} color={colors.text} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        contentContainerStyle={{ paddingBottom: 110 }}
        ListHeaderComponent={
          <View>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => setShowComposer(true)}
              style={[styles.composerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.composerTopRow}>
                <Image source={{ uri: viewer.avatar }} style={styles.composerAvatar} />
                <View style={[styles.composerInputPlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
                  <Text style={[styles.composerPlaceholderText, { color: colors.textTertiary }]}>
                    What's on your mind? 📸
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowComposer(true)} style={styles.composerPostButton}>
                  <Text style={[styles.composerPostText, { color: colors.accent }]}>Post</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesRow}>
              {stories.map((story) => (
                <StoryBubble key={story.id} story={story} colors={colors} />
              ))}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => (
          <FeedPost
            post={item}
            colors={colors}
            liked={Boolean(likedMap[item.id])}
            saved={Boolean(savedMap[item.id])}
            likeCount={getLikeCount(item)}
            commentCount={getCommentCount(item)}
            comments={getDisplayComments(item)}
            flashHeart={heartFlashPostId === item.id}
            onToggleLike={() => toggleLike(item)}
            onQuickLike={() => quickLike(item)}
            onOpenComments={() => openComments(item.id, true)}
            onToggleSave={() => toggleSave(item.id)}
            onShare={() => sharePost(item)}
            onMediaTap={() => item.imageUrl && openViewer(item.id)}
            onShowMore={() => openMore(item.id)}
          />
        )}
      />
      <CommentsSheet
        visible={Boolean(activeCommentPost)}
        colors={colors}
        post={activeCommentPost}
        comments={activeCommentPost ? getDisplayComments(activeCommentPost) : []}
        commentCount={activeCommentPost ? getCommentCount(activeCommentPost) : 0}
        draft={activeCommentPost ? (commentDrafts[activeCommentPost.id] ?? '') : ''}
        autoFocus={autoFocusComments}
        onChangeDraft={(text) => activeCommentPost && setCommentDrafts((prev) => ({ ...prev, [activeCommentPost.id]: text }))}
        onClose={closeComments}
        onSubmit={submitComment}
      />
      <MediaViewer
        visible={Boolean(activeViewerPost?.imageUrl)}
        post={activeViewerPost}
        liked={activeViewerPost ? Boolean(likedMap[activeViewerPost.id]) : false}
        saved={activeViewerPost ? Boolean(savedMap[activeViewerPost.id]) : false}
        likeCount={activeViewerPost ? getLikeCount(activeViewerPost) : 0}
        flashHeart={activeViewerPost ? heartFlashPostId === activeViewerPost.id : false}
        onClose={closeViewer}
        onDoubleTapLike={viewerQuickLike}
        onToggleLike={() => activeViewerPost && toggleLike(activeViewerPost)}
        onToggleSave={() => activeViewerPost && toggleSave(activeViewerPost.id)}
        onOpenComments={viewerOpenComments}
        onShowMore={() => activeViewerPost && openMore(activeViewerPost.id)}
      />
      <PostMoreSheet
        visible={Boolean(activeMorePost)}
        post={activeMorePost}
        colors={colors}
        onClose={closeMore}
        onReport={handleReport}
      />
      <CreatePostModal
        visible={showComposer}
        colors={colors}
        onClose={() => setShowComposer(false)}
        onPublish={handleComposerPublish}
      />
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerBar: { paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  headerIconButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  composerCard: { marginHorizontal: 12, marginTop: 12, marginBottom: 14, borderWidth: 1, borderRadius: 18, padding: 12 },
  composerTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  composerAvatar: { width: 38, height: 38, borderRadius: 19 },
  composerInputPlaceholder: { flex: 1, minHeight: 42, borderRadius: 14, paddingHorizontal: 14, justifyContent: 'center' },
  composerPlaceholderText: { fontSize: 14 },
  composerPostButton: { paddingHorizontal: 6 },
  composerPostText: { fontSize: 14, fontWeight: '700' },
  storiesRow: { paddingHorizontal: 12, paddingBottom: 14 },
  storyBubble: { width: 74, alignItems: 'center', marginRight: 10 },
  storyRing: { width: 66, height: 66, borderRadius: 33, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  storyAvatar: { width: 58, height: 58, borderRadius: 29 },
  storyLabel: { marginTop: 5, fontSize: 11 },
  postCard: { marginBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  postHeader: { paddingHorizontal: 12, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  postHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  postAvatar: { width: 34, height: 34, borderRadius: 17 },
  postUser: { fontSize: 14, fontWeight: '700' },
  postTime: { fontSize: 11, marginTop: 1 },
  postMoreButton: { padding: 4 },
  mediaWrap: { marginHorizontal: 12, borderRadius: 22, overflow: 'hidden' },
  fullImageWrap: { backgroundColor: '#111111' },
  postMedia: { width: '100%', backgroundColor: '#E5E5E5' },
  reelMediaWrap: { backgroundColor: '#000000' },
  textOnlyCard: { minHeight: 250, marginHorizontal: 12, borderRadius: 22, padding: 22, justifyContent: 'center', overflow: 'hidden' },
  textOnlyCopy: { fontSize: 24, lineHeight: 32, fontWeight: '600' },
  heartFlashWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.08)' },
  postActionsRow: { paddingHorizontal: 12, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  postActionsLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconButton: { padding: 2 },
  postMetaBlock: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 14 },
  postBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  postBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  postBadgeSell: { backgroundColor: '#FFE4D6', borderColor: '#FF6B35' },
  postBadgeSellText: { color: '#C2410C', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  postBadgePost: { backgroundColor: 'transparent' },
  postBadgePostText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  postCategoryBadge: { backgroundColor: 'rgba(255,255,255,0.06)' },
  postCategoryBadgeText: { fontSize: 11, fontWeight: '700' },
  likesText: { fontSize: 14, fontWeight: '700' },
  captionLine: { marginTop: 4, fontSize: 14, lineHeight: 20 },
  captionUser: { fontWeight: '700' },
  commentPreviewTouch: { marginTop: 6 },
  viewCommentsText: { fontSize: 13, marginBottom: 4 },
  previewCommentLine: { marginTop: 2, fontSize: 13 },
  previewCommentAuthor: { fontWeight: '700' },
  postTimeFooter: { marginTop: 6, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3 },

  // ── Comments Sheet ──
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheetKeyboardWrap: { justifyContent: 'flex-end' },
  sheetCard: { maxHeight: SCREEN_HEIGHT * 0.78, borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden' },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, position: 'relative' },
  sheetTitle: { fontSize: 16, fontWeight: '700' },
  sheetMeta: { position: 'absolute', left: 16, fontSize: 12 },
  sheetCloseButton: { position: 'absolute', right: 12, padding: 6 },
  sheetPostPreview: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  sheetPostAvatar: { width: 34, height: 34, borderRadius: 17 },
  sheetPostTextWrap: { flex: 1 },
  sheetPostUser: { fontSize: 14, fontWeight: '700' },
  sheetPostCaption: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  sheetCommentsContent: { paddingHorizontal: 16, paddingVertical: 14, gap: 14 },
  sheetEmptyWrap: { alignItems: 'center', paddingVertical: 40 },
  sheetEmptyTitle: { fontSize: 16, fontWeight: '700' },
  sheetEmptyText: { marginTop: 4, fontSize: 13 },
  sheetCommentRow: { flexDirection: 'row', gap: 10 },
  sheetCommentAvatar: { width: 32, height: 32, borderRadius: 16 },
  sheetCommentBody: { flex: 1 },
  sheetCommentLine: { fontSize: 14, lineHeight: 20 },
  sheetCommentAuthor: { fontWeight: '700' },
  sheetCommentText: {},
  sheetCommentTime: { marginTop: 3, fontSize: 11 },
  sheetComposer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  sheetComposerAvatar: { width: 32, height: 32, borderRadius: 16 },
  sheetInput: { flex: 1, minHeight: 42, borderRadius: 16, paddingHorizontal: 14, fontSize: 14 },
  sheetSendButton: { paddingHorizontal: 6 },
  sheetSendText: { fontSize: 14, fontWeight: '700' },

  // ── Media Viewer ──
  viewerContainer: { flex: 1, backgroundColor: '#000000' },
  viewerTopBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  viewerCloseButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  viewerTopUser: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewerTopAvatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  viewerTopUsername: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  viewerMoreButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  viewerMediaArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  viewerImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.72 },
  viewerHeartFlash: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  viewerBottomBar: { paddingHorizontal: 14, paddingTop: 10 },
  viewerActionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  viewerActionLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  viewerActionButton: { padding: 3 },
  viewerLikes: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginBottom: 6 },
  viewerCaption: { marginBottom: 6, lineHeight: 20 },
  viewerCaptionUser: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  viewerCaptionText: { color: '#FFFFFF', fontSize: 14 },
  viewerTimestamp: { color: 'rgba(255,255,255,0.5)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 },

  // ── More Sheet (Three-Dot Menu) ──
  moreOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  moreBottomSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 },
  moreTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', paddingVertical: 14 },
  moreOption: { paddingVertical: 16, paddingHorizontal: 20, borderTopWidth: StyleSheet.hairlineWidth },
  moreOptionText: { fontSize: 15, textAlign: 'center' },
  moreCancel: { paddingVertical: 16, paddingHorizontal: 20, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8 },
  moreCancelText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },

  // ── Create Modal (Gallery / Camera / Story) ──
  createContainer: { flex: 1 },
  createHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  createTitle: { fontSize: 17, fontWeight: '700' },
  createShareBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  createShareText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  createContent: { flex: 1 },
  createScrollContent: { padding: 16, gap: 16 },
  createImagePreviewWrap: { alignSelf: 'center', position: 'relative' },
  createImagePreview: { width: SCREEN_WIDTH - 32, borderRadius: 18, backgroundColor: '#111111' },
  createRemoveImage: { position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  createPlaceholder: { width: SCREEN_WIDTH - 32, height: SCREEN_HEIGHT * 0.3, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  createPlaceholderIcon: { fontSize: 48 },
  createPlaceholderText: { marginTop: 10, fontSize: 14 },
  createCaptionInput: { fontSize: 16, minHeight: 80, paddingVertical: 8, lineHeight: 22 },
  composerMetaSection: { marginTop: 8, gap: 10 },
  composerMetaLabel: { fontSize: 13, fontWeight: '700' },
  composerMetaRow: { flexDirection: 'row', gap: 10 },
  composerMetaChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  composerMetaChipText: { fontSize: 13, fontWeight: '700' },
  categoryChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryChip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  categoryChipText: { fontSize: 12, fontWeight: '700' },
  createToolbar: {},
  createToolbarRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 14, paddingHorizontal: 20, borderTopWidth: StyleSheet.hairlineWidth },
  createTool: { alignItems: 'center', gap: 6, paddingVertical: 6 },
  createToolIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  createToolLabel: { fontSize: 12, fontWeight: '500' },
  createModeIcon: { fontSize: 20 },
  createModeHint: { marginHorizontal: 16, marginBottom: 12, borderRadius: 10, padding: 10, alignItems: 'center' },
  createModeHintText: { fontSize: 12, fontWeight: '600' },
});
