import { Bookmark, Heart, MessageCircle, Repeat, X } from 'lucide-react-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  ImageBackground,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useSocial } from '@/contexts/SocialContext';
import { useTabBar } from '@/contexts/TabBarContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Post, Story, mockPosts, mockStories } from '@/mocks/data';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MEDIA_HEIGHT = Math.min(SCREEN_WIDTH * 1.12, 520);

const viewer = {
  id: 'local-viewer',
  name: 'You',
  username: 'you',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160&h=160&fit=crop',
  isVerified: false,
  followersCount: 0,
};

function StoryCard({ story, colors }: { story: Story; colors: any }) {
  return (
    <TouchableOpacity activeOpacity={0.9} style={[styles.storyCard, { borderColor: colors.border }]}> 
      <ImageBackground
        source={{ uri: story.imageUrl || story.user.avatar }}
        style={styles.storyCardImage}
        imageStyle={styles.storyCardImageInner}
      >
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']} style={styles.storyCardOverlay}>
          <View style={[styles.storyCardBadge, { backgroundColor: story.viewed ? 'rgba(255,255,255,0.18)' : '#1F8BFF' }]}>
            <Text style={styles.storyCardBadgeText}>{story.viewed ? 'Seen' : 'Live now'}</Text>
          </View>
          <View style={styles.storyCardFooter}>
            <Image source={{ uri: story.user.avatar }} style={styles.storyCardAvatar} />
            <View style={styles.storyCardTextWrap}>
              <Text style={styles.storyCardUser} numberOfLines={1}>{story.user.username}</Text>
              <Text style={styles.storyCardTime}>{story.timestamp}</Text>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </TouchableOpacity>
  );
}

function ActionButton({
  icon,
  label,
  count,
  active,
  colors,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active?: boolean;
  colors: any;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      style={[
        styles.actionButton,
        {
          backgroundColor: active ? colors.accentGlow : colors.backgroundSecondary,
          borderColor: active ? colors.accent : colors.border,
        },
      ]}
    >
      {icon}
      <Text style={[styles.actionLabel, { color: active ? colors.accent : colors.text }]}>{label}</Text>
      <Text style={[styles.actionCount, { color: active ? colors.accent : colors.textSecondary }]}>{count}</Text>
    </TouchableOpacity>
  );
}

function FeedCard({
  post,
  colors,
  liked,
  saved,
  likeCount,
  onToggleLike,
  onToggleSave,
  onOpen,
}: {
  post: Post;
  colors: any;
  liked: boolean;
  saved: boolean;
  likeCount: number;
  onToggleLike: () => void;
  onToggleSave: () => void;
  onOpen: () => void;
}) {
  const hasMedia = Boolean(post.imageUrl);

  return (
    <View style={[styles.feedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
      <View style={styles.feedCardHeader}>
        <View style={styles.feedCardAuthorRow}>
          <Image source={{ uri: post.user.avatar }} style={styles.feedCardAvatar} />
          <View style={styles.feedCardAuthorText}>
            <Text style={[styles.feedCardName, { color: colors.text }]}>{post.user.name}</Text>
            <Text style={[styles.feedCardMeta, { color: colors.textSecondary }]}>@{post.user.username} • {post.timestamp}</Text>
          </View>
        </View>
        {post.apparentlyTag ? (
          <View style={[styles.feedTag, { backgroundColor: colors.accentGlow, borderColor: colors.accent }]}> 
            <Text style={[styles.feedTagText, { color: colors.accent }]}>{post.apparentlyTag}</Text>
          </View>
        ) : null}
      </View>

      {hasMedia ? (
        <TouchableOpacity activeOpacity={0.95} onPress={onOpen} style={styles.mediaTapWrap}>
          <ImageBackground
            source={{ uri: post.imageUrl }}
            style={styles.feedMedia}
            imageStyle={styles.feedMediaImage}
          >
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)']} style={styles.feedMediaOverlay}>
              <View style={[styles.mediaHint, { backgroundColor: 'rgba(10,10,10,0.58)' }]}>
                <Text style={styles.mediaHintText}>Swipe mode</Text>
              </View>
            </LinearGradient>
          </ImageBackground>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={onOpen}
          style={[styles.textPanel, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
        >
          <Text style={[styles.textPanelCopy, { color: colors.text }]} numberOfLines={6}>{post.content}</Text>
        </TouchableOpacity>
      )}

      <View style={styles.feedCardBody}>
        {hasMedia ? (
          <Text style={[styles.feedCardCopy, { color: colors.text }]} numberOfLines={3}>{post.content}</Text>
        ) : null}

        <View style={styles.feedCardActions}>
          <ActionButton
            label="Like"
            count={likeCount}
            active={liked}
            colors={colors}
            onPress={onToggleLike}
            icon={<Heart size={18} color={liked ? colors.accent : colors.textSecondary} fill={liked ? colors.accent : 'none'} />}
          />
          <ActionButton
            label="Comment"
            count={post.comments}
            colors={colors}
            icon={<MessageCircle size={18} color={colors.textSecondary} />}
          />
          <ActionButton
            label="Repost"
            count={post.shares}
            colors={colors}
            icon={<Repeat size={18} color={colors.textSecondary} />}
          />
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={onToggleSave}
            style={[
              styles.saveButton,
              {
                backgroundColor: saved ? colors.accentGlow : colors.backgroundSecondary,
                borderColor: saved ? colors.accent : colors.border,
              },
            ]}
          >
            <Bookmark size={18} color={saved ? colors.accent : colors.textSecondary} fill={saved ? colors.accent : 'none'} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function ViewerSlide({
  post,
  colors,
  liked,
  saved,
  likeCount,
  onToggleLike,
  onToggleSave,
  index,
  total,
}: {
  post: Post;
  colors: any;
  liked: boolean;
  saved: boolean;
  likeCount: number;
  onToggleLike: () => void;
  onToggleSave: () => void;
  index: number;
  total: number;
}) {
  const hasMedia = Boolean(post.imageUrl);

  return (
    <View style={[styles.viewerSlide, { height: SCREEN_HEIGHT }]}> 
      <View style={styles.viewerMetaTop}>
        <View style={[styles.viewerCounter, { backgroundColor: 'rgba(12,12,12,0.54)' }]}>
          <Text style={styles.viewerCounterText}>{index + 1} / {total}</Text>
        </View>
      </View>

      <View style={styles.viewerContentWrap}>
        {hasMedia ? (
          <Image source={{ uri: post.imageUrl }} style={styles.viewerMedia} resizeMode="cover" />
        ) : (
          <LinearGradient colors={['#111827', '#1F2937']} style={styles.viewerTextOnlyCard}>
            <Text style={styles.viewerTextOnlyCopy}>{post.content}</Text>
          </LinearGradient>
        )}

        <View style={[styles.viewerDetailsCard, { backgroundColor: 'rgba(10,10,10,0.72)', borderColor: 'rgba(255,255,255,0.08)' }]}>
          <View style={styles.viewerAuthorRow}>
            <Image source={{ uri: post.user.avatar }} style={styles.viewerAuthorAvatar} />
            <View style={styles.viewerAuthorTextWrap}>
              <Text style={styles.viewerAuthorName}>{post.user.name}</Text>
              <Text style={styles.viewerAuthorMeta}>@{post.user.username} • {post.timestamp}</Text>
            </View>
          </View>
          <Text style={styles.viewerCopy}>{post.content}</Text>

          <View style={styles.viewerActions}>
            <ActionButton
              label="Like"
              count={likeCount}
              active={liked}
              colors={{ ...colors, backgroundSecondary: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.14)', text: '#FFFFFF', textSecondary: 'rgba(255,255,255,0.8)', accentGlow: 'rgba(31,139,255,0.18)' }}
              onPress={onToggleLike}
              icon={<Heart size={18} color={liked ? '#4AA8FF' : 'rgba(255,255,255,0.8)'} fill={liked ? '#4AA8FF' : 'none'} />}
            />
            <ActionButton
              label="Comment"
              count={post.comments}
              colors={{ ...colors, backgroundSecondary: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.14)', text: '#FFFFFF', textSecondary: 'rgba(255,255,255,0.8)', accentGlow: 'rgba(31,139,255,0.18)' }}
              icon={<MessageCircle size={18} color={'rgba(255,255,255,0.8)'} />}
            />
            <ActionButton
              label="Repost"
              count={post.shares}
              colors={{ ...colors, backgroundSecondary: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.14)', text: '#FFFFFF', textSecondary: 'rgba(255,255,255,0.8)', accentGlow: 'rgba(31,139,255,0.18)' }}
              icon={<Repeat size={18} color={'rgba(255,255,255,0.8)'} />}
            />
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={onToggleSave}
              style={[
                styles.saveButton,
                {
                  backgroundColor: saved ? 'rgba(31,139,255,0.18)' : 'rgba(255,255,255,0.08)',
                  borderColor: saved ? '#1F8BFF' : 'rgba(255,255,255,0.14)',
                },
              ]}
            >
              <Bookmark size={18} color={saved ? '#4AA8FF' : 'rgba(255,255,255,0.8)'} fill={saved ? '#4AA8FF' : 'none'} />
            </TouchableOpacity>
          </View>

          <Text style={styles.viewerSwipeHint}>Swipe up for the next post</Text>
        </View>
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { hideTabBar, showTabBar } = useTabBar();
  const { getAllPosts, getAllStories, createPost } = useSocial();

  const [draft, setDraft] = useState('');
  const [localPosts, setLocalPosts] = useState<Post[]>([]);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [viewerPostId, setViewerPostId] = useState<string | null>(null);
  const lastOffsetRef = useRef(0);

  const socialPosts = getAllPosts();
  const socialStories = getAllStories();

  const basePosts = socialPosts.length ? socialPosts : mockPosts;
  const posts = useMemo(() => [...localPosts, ...basePosts], [localPosts, basePosts]);
  const stories = useMemo(() => (socialStories.length ? socialStories : mockStories).slice(0, 10), [socialStories]);
  const viewerIndex = useMemo(() => Math.max(posts.findIndex((post) => post.id === viewerPostId), 0), [posts, viewerPostId]);

  const impact = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  };

  const getLikeCount = useCallback((post: Post) => likeCounts[post.id] ?? post.likes, [likeCounts]);

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

  const toggleSave = useCallback((postId: string) => {
    setSavedMap((prev) => ({ ...prev, [postId]: !prev[postId] }));
    impact();
  }, []);

  const openViewer = useCallback((postId: string) => {
    setViewerPostId(postId);
    hideTabBar();
    impact(Haptics.ImpactFeedbackStyle.Medium);
  }, [hideTabBar]);

  const closeViewer = useCallback(() => {
    setViewerPostId(null);
    showTabBar();
  }, [showTabBar]);

  const header = (
    <View>
      <LinearGradient
        colors={[colors.background, colors.backgroundSecondary]}
        style={[styles.headerShell, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}
      >
        <View style={styles.headerTopRow}>
          <View style={styles.headerCopyWrap}>
            <Text style={[styles.headerEyebrow, { color: colors.textSecondary }]}>SOCIAL FEED</Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Pulse Board</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Big media, familiar actions, and swipe-through browsing.</Text>
          </View>
          <View style={[styles.headerBadge, { backgroundColor: colors.accentGlow, borderColor: colors.accent }]}> 
            <Text style={[styles.headerBadgeText, { color: colors.accent }]}>Live</Text>
          </View>
        </View>

        <View style={[styles.composerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <View style={styles.composerTopRow}>
            <Image source={{ uri: viewer.avatar }} style={styles.composerAvatar} />
            <View style={styles.composerPromptWrap}>
              <Text style={[styles.composerPromptTitle, { color: colors.text }]}>Post something people can react to</Text>
              <Text style={[styles.composerPromptSubtitle, { color: colors.textSecondary }]}>A quick update, a photo moment, a win, or something worth sharing.</Text>
            </View>
          </View>
          <TextInput
            multiline
            placeholder="What’s happening?"
            placeholderTextColor={colors.textTertiary}
            style={[
              styles.composerInput,
              {
                backgroundColor: colors.backgroundSecondary,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={draft}
            onChangeText={setDraft}
            textAlignVertical="top"
          />
          <View style={styles.composerFooter}>
            <View style={styles.composerModeRow}>
              {['Photo first', 'Question', 'Update'].map((label, index) => (
                <View
                  key={label}
                  style={[
                    styles.modeChip,
                    {
                      backgroundColor: index === 0 ? colors.accentGlow : colors.backgroundSecondary,
                      borderColor: index === 0 ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.modeChipText, { color: index === 0 ? colors.accent : colors.textSecondary }]}>{label}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity activeOpacity={0.88} onPress={handlePublish} style={[styles.publishButton, { backgroundColor: colors.text }]}>
              <Text style={[styles.publishButtonText, { color: colors.background }]}>Post</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Current waves</Text>
          <Text style={[styles.sectionCaption, { color: colors.textSecondary }]}>Quick visual updates from your people</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyScrollContent}>
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} colors={colors} />
          ))}
        </ScrollView>
      </View>

      <View style={styles.sectionWrap}>
        <View style={[styles.sectionHeader, styles.sectionHeaderTight]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Fresh posts</Text>
          <Text style={[styles.sectionCaption, { color: colors.textSecondary }]}>Tap a post, then swipe up to move through the feed.</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}> 
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        contentContainerStyle={styles.feedContent}
        renderItem={({ item }) => (
          <FeedCard
            post={item}
            colors={colors}
            liked={Boolean(likedMap[item.id])}
            saved={Boolean(savedMap[item.id])}
            likeCount={getLikeCount(item)}
            onToggleLike={() => toggleLike(item)}
            onToggleSave={() => toggleSave(item.id)}
            onOpen={() => openViewer(item.id)}
          />
        )}
      />

      <Modal visible={Boolean(viewerPostId)} animationType="fade" presentationStyle="fullScreen" onRequestClose={closeViewer}>
        <View style={styles.viewerShell}>
          <TouchableOpacity activeOpacity={0.85} onPress={closeViewer} style={[styles.viewerClose, { top: insets.top + 10 }]}>
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <FlatList
            key={viewerPostId ?? 'viewer'}
            data={posts}
            pagingEnabled
            initialScrollIndex={viewerIndex}
            getItemLayout={(_, index) => ({ length: SCREEN_HEIGHT, offset: SCREEN_HEIGHT * index, index })}
            keyExtractor={(item) => `viewer-${item.id}`}
            showsVerticalScrollIndicator={false}
            decelerationRate="fast"
            renderItem={({ item, index }) => (
              <ViewerSlide
                post={item}
                colors={colors}
                index={index}
                total={posts.length}
                liked={Boolean(likedMap[item.id])}
                saved={Boolean(savedMap[item.id])}
                likeCount={getLikeCount(item)}
                onToggleLike={() => toggleLike(item)}
                onToggleSave={() => toggleSave(item.id)}
              />
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  feedContent: {
    paddingBottom: 110,
  },
  headerShell: {
    paddingHorizontal: 18,
    paddingBottom: 22,
    borderBottomWidth: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerCopyWrap: {
    flex: 1,
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 270,
  },
  headerBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  composerCard: {
    marginTop: 18,
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  composerTopRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  composerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 18,
  },
  composerPromptWrap: {
    flex: 1,
  },
  composerPromptTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  composerPromptSubtitle: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
  },
  composerInput: {
    minHeight: 112,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    lineHeight: 21,
  },
  composerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  composerModeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  modeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modeChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  publishButton: {
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  publishButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  sectionWrap: {
    paddingTop: 18,
  },
  sectionHeader: {
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  sectionHeaderTight: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sectionCaption: {
    marginTop: 3,
    fontSize: 13,
  },
  storyScrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  storyCard: {
    width: 156,
    height: 194,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    marginRight: 12,
  },
  storyCardImage: {
    flex: 1,
  },
  storyCardImageInner: {
    borderRadius: 28,
  },
  storyCardOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 14,
  },
  storyCardBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  storyCardBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  storyCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  storyCardAvatar: {
    width: 34,
    height: 34,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  storyCardTextWrap: {
    flex: 1,
  },
  storyCardUser: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  storyCardTime: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    marginTop: 2,
  },
  feedCard: {
    marginHorizontal: 18,
    marginBottom: 18,
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
  },
  feedCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 12,
  },
  feedCardAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  feedCardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
  },
  feedCardAuthorText: {
    flex: 1,
  },
  feedCardName: {
    fontSize: 15,
    fontWeight: '700',
  },
  feedCardMeta: {
    marginTop: 2,
    fontSize: 12,
  },
  feedTag: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  feedTagText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  mediaTapWrap: {
    paddingHorizontal: 12,
  },
  feedMedia: {
    height: MEDIA_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  feedMediaImage: {
    borderRadius: 24,
  },
  feedMediaOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 14,
  },
  mediaHint: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mediaHintText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  textPanel: {
    marginHorizontal: 12,
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    minHeight: 220,
    justifyContent: 'center',
  },
  textPanelCopy: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
  },
  feedCardBody: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 14,
  },
  feedCardCopy: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '500',
  },
  feedCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  saveButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerShell: {
    flex: 1,
    backgroundColor: '#050505',
  },
  viewerClose: {
    position: 'absolute',
    right: 18,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(20,20,20,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerSlide: {
    paddingTop: 68,
    paddingHorizontal: 14,
    paddingBottom: 26,
    justifyContent: 'space-between',
  },
  viewerMetaTop: {
    alignItems: 'flex-start',
  },
  viewerCounter: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  viewerCounterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  viewerContentWrap: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
  },
  viewerMedia: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.56,
    borderRadius: 30,
    backgroundColor: '#161616',
  },
  viewerTextOnlyCard: {
    minHeight: SCREEN_HEIGHT * 0.4,
    borderRadius: 30,
    padding: 28,
    justifyContent: 'center',
  },
  viewerTextOnlyCopy: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
  },
  viewerDetailsCard: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 16,
    gap: 14,
  },
  viewerAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  viewerAuthorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
  },
  viewerAuthorTextWrap: {
    flex: 1,
  },
  viewerAuthorName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  viewerAuthorMeta: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    fontSize: 12,
  },
  viewerCopy: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  viewerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  viewerSwipeHint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});
