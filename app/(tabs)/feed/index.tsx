import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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

function getFeedMediaHeight(post: Post) {
  return isReelStyle(post) ? INSTAGRAM_REEL_HEIGHT : INSTAGRAM_PHOTO_HEIGHT;
}

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

function CommentsSheet({
  visible,
  colors,
  post,
  comments,
  commentCount,
  draft,
  autoFocus,
  onChangeDraft,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  colors: any;
  post: Post | null;
  comments: SocialComment[];
  commentCount: number;
  draft: string;
  autoFocus: boolean;
  onChangeDraft: (text: string) => void;
  onClose: () => void;
  onSubmit: () => void;
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

function FeedPost({
  post,
  colors,
  liked,
  saved,
  likeCount,
  commentCount,
  comments,
  flashHeart,
  onToggleLike,
  onQuickLike,
  onOpenComments,
  onToggleSave,
  onShare,
}: {
  post: Post;
  colors: any;
  liked: boolean;
  saved: boolean;
  likeCount: number;
  commentCount: number;
  comments: SocialComment[];
  flashHeart: boolean;
  onToggleLike: () => void;
  onQuickLike: () => void;
  onOpenComments: () => void;
  onToggleSave: () => void;
  onShare: () => void;
}) {
  const hasMedia = Boolean(post.imageUrl);
  const mediaHeight = getFeedMediaHeight(post);
  const reelStyle = isReelStyle(post);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMediaTap = useCallback(() => {
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = null;
      onQuickLike();
      return;
    }

    tapTimeoutRef.current = setTimeout(() => {
      tapTimeoutRef.current = null;
    }, DOUBLE_TAP_DELAY);
  }, [onQuickLike]);

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
        <TouchableOpacity style={styles.postMoreButton}>
          <MoreHorizontal size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {hasMedia ? (
        <Pressable onPress={handleMediaTap} style={[styles.mediaWrap, reelStyle && styles.reelMediaWrap]}>
          <Image source={{ uri: post.imageUrl }} style={[styles.postMedia, { height: mediaHeight }]} resizeMode="cover" />
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

export default function FeedScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { hideTabBar, showTabBar } = useTabBar();
  const { getAllPosts, getAllStories, createPost, getComments, addComment, sharePost } = useSocial();

  const [draft, setDraft] = useState('');
  const [localPosts, setLocalPosts] = useState<Post[]>([]);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [heartFlashPostId, setHeartFlashPostId] = useState<string | null>(null);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [autoFocusComments, setAutoFocusComments] = useState(false);
  const lastOffsetRef = useRef(0);

  const socialPosts = getAllPosts();
  const socialStories = getAllStories();
  const basePosts = socialPosts.length ? socialPosts : mockPosts;
  const stories = useMemo(() => (socialStories.length ? socialStories : mockStories).slice(0, 10), [socialStories]);
  const posts = useMemo(() => [...localPosts, ...basePosts], [localPosts, basePosts]);
  const activeCommentPost = useMemo(() => posts.find((post) => post.id === commentsPostId) ?? null, [posts, commentsPostId]);

  const impact = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  };

  const getLikeCount = useCallback((post: Post) => likeCounts[post.id] ?? post.likes, [likeCounts]);

  const getDisplayComments = useCallback((post: Post) => {
    const live = getComments(post.id);
    return [...live, ...buildSeededComments(post)];
  }, [getComments]);

  const getCommentCount = useCallback((post: Post) => post.comments + getComments(post.id).length, [getComments]);

  const flashHeart = useCallback((postId: string) => {
    setHeartFlashPostId(postId);
    setTimeout(() => setHeartFlashPostId((current) => (current === postId ? null : current)), 650);
  }, []);

  const handlePublish = useCallback(() => {
    const clean = draft.trim();
    if (!clean) return;

    const optimisticPost: Post = {
      id: `local-${Date.now()}`,
      user: viewer,
      content: clean,
      timestamp: 'Just now',
      likes: 0,
      comments: 0,
      shares: 0,
    };

    setLocalPosts((prev) => [optimisticPost, ...prev]);
    setDraft('');
    createPost(clean);
    impact(Haptics.ImpactFeedbackStyle.Medium);
  }, [createPost, draft]);

  const handleScroll = useCallback((event: any) => {
    const currentOffset = event.nativeEvent.contentOffset.y;
    if (currentOffset > lastOffsetRef.current && currentOffset > 40) {
      hideTabBar();
    } else if (currentOffset < lastOffsetRef.current) {
      showTabBar();
    }
    lastOffsetRef.current = currentOffset;
  }, [hideTabBar, showTabBar]);

  const toggleLike = useCallback((post: Post) => {
    const nextLiked = !likedMap[post.id];
    setLikedMap((prev) => ({ ...prev, [post.id]: nextLiked }));
    setLikeCounts((prev) => ({
      ...prev,
      [post.id]: (prev[post.id] ?? post.likes) + (nextLiked ? 1 : -1),
    }));
    impact();
  }, [likedMap]);

  const quickLike = useCallback((post: Post) => {
    if (!likedMap[post.id]) {
      setLikedMap((prev) => ({ ...prev, [post.id]: true }));
      setLikeCounts((prev) => ({
        ...prev,
        [post.id]: (prev[post.id] ?? post.likes) + 1,
      }));
    }
    flashHeart(post.id);
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

  const updateCommentDraft = useCallback((postId: string, text: string) => {
    setCommentDrafts((prev) => ({ ...prev, [postId]: text }));
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

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}> 
      <View style={[styles.headerBar, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}> 
        <Text style={[styles.headerTitle, { color: colors.text }]}>Feed</Text>
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
            <View style={[styles.composerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <View style={styles.composerTopRow}>
                <Image source={{ uri: viewer.avatar }} style={styles.composerAvatar} />
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Share something..."
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.composerInput, { backgroundColor: colors.backgroundSecondary, color: colors.text }]}
                />
                <TouchableOpacity onPress={handlePublish} style={styles.composerPostButton}>
                  <Text style={[styles.composerPostText, { color: colors.accent }]}>Post</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.storiesRow}
            >
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
        onChangeDraft={(text) => activeCommentPost && updateCommentDraft(activeCommentPost.id, text)}
        onClose={closeComments}
        onSubmit={submitComment}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerBar: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  composerCard: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  composerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  composerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  composerInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  composerPostButton: {
    paddingHorizontal: 6,
  },
  composerPostText: {
    fontSize: 14,
    fontWeight: '700',
  },
  storiesRow: {
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  storyBubble: {
    width: 74,
    alignItems: 'center',
    marginRight: 10,
  },
  storyRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  storyLabel: {
    marginTop: 5,
    fontSize: 11,
  },
  postCard: {
    marginBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  postHeader: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  postAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  postUser: {
    fontSize: 14,
    fontWeight: '700',
  },
  postTime: {
    fontSize: 11,
    marginTop: 1,
  },
  postMoreButton: {
    padding: 4,
  },
  mediaWrap: {
    marginHorizontal: 12,
    borderRadius: 22,
    overflow: 'hidden',
  },
  postMedia: {
    width: '100%',
    backgroundColor: '#E5E5E5',
  },
  reelMediaWrap: {
    backgroundColor: '#000000',
  },
  textOnlyCard: {
    minHeight: 250,
    marginHorizontal: 12,
    borderRadius: 22,
    padding: 22,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  textOnlyCopy: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
  },
  heartFlashWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  postActionsRow: {
    paddingHorizontal: 12,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postActionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    padding: 2,
  },
  postMetaBlock: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 14,
  },
  likesText: {
    fontSize: 14,
    fontWeight: '700',
  },
  captionLine: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
  },
  captionUser: {
    fontWeight: '700',
  },
  commentPreviewTouch: {
    marginTop: 6,
    gap: 3,
  },
  viewCommentsText: {
    fontSize: 14,
  },
  previewCommentLine: {
    fontSize: 13,
    lineHeight: 18,
  },
  previewCommentAuthor: {
    fontWeight: '700',
  },
  postTimeFooter: {
    marginTop: 8,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheetKeyboardWrap: {
    justifyContent: 'flex-end',
  },
  sheetCard: {
    maxHeight: SCREEN_HEIGHT * 0.78,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    position: 'relative',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sheetMeta: {
    position: 'absolute',
    left: 16,
    fontSize: 12,
  },
  sheetCloseButton: {
    position: 'absolute',
    right: 12,
    padding: 6,
  },
  sheetPostPreview: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetPostAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  sheetPostTextWrap: {
    flex: 1,
  },
  sheetPostUser: {
    fontSize: 14,
    fontWeight: '700',
  },
  sheetPostCaption: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  sheetCommentsContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  sheetEmptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  sheetEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sheetEmptyText: {
    marginTop: 4,
    fontSize: 13,
  },
  sheetCommentRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sheetCommentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  sheetCommentBody: {
    flex: 1,
  },
  sheetCommentLine: {
    fontSize: 14,
    lineHeight: 20,
  },
  sheetCommentAuthor: {
    fontWeight: '700',
  },
  sheetCommentText: {},
  sheetCommentTime: {
    marginTop: 3,
    fontSize: 11,
  },
  sheetComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetComposerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  sheetInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: 16,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  sheetSendButton: {
    paddingHorizontal: 6,
  },
  sheetSendText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
