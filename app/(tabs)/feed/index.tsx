import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Send,
  Plus,
} from 'lucide-react-native';
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  FlatList,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/contexts/ThemeContext';
import { useSocial } from '@/contexts/SocialContext';
import { useTabBar } from '@/contexts/TabBarContext';
import { mockPosts, mockStories, Post, Story } from '@/mocks/data';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const POST_IMAGE_HEIGHT = SCREEN_WIDTH;
const STORY_SIZE = 68;
const STORY_RING = 3;

function StoryCircle({ story, isFirst }: { story: Story; isFirst: boolean }) {
  const { colors } = useTheme();
  const hasGradient = !story.viewed;

  return (
    <TouchableOpacity
      style={styles.storyItem}
      onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      activeOpacity={0.7}
    >
      {isFirst ? (
        <View style={styles.addStoryContainer}>
          <View style={[styles.storyImageWrapper, { borderColor: colors.border }]}>
            <Image source={{ uri: story.user.avatar }} style={styles.storyImage} />
          </View>
          <View style={[styles.addStoryBadge, { backgroundColor: colors.accent }]}>
            <Plus size={14} color="#FFF" />
          </View>
          <Text style={[styles.storyName, { color: colors.textSecondary }]} numberOfLines={1}>
            Your Story
          </Text>
        </View>
      ) : (
        <View>
          <LinearGradient
            colors={hasGradient ? ['#F58529', '#DD2A7B', '#8134AF'] : ['#8E8E8E', '#8E8E8E']}
            style={styles.storyRing}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
          >
            <View style={[styles.storyImageWrapper, { borderColor: colors.background }]}>
              <Image source={{ uri: story.user.avatar }} style={styles.storyImage} />
            </View>
          </LinearGradient>
          <Text style={[styles.storyName, { color: colors.textSecondary }]} numberOfLines={1}>
            {story.user.username}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function PostCard({ post }: { post: Post }) {
  const { colors } = useTheme();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [showFullCaption, setShowFullCaption] = useState(false);
  const captionLong = post.content.length > 120;

  const handleLike = () => {
    setLiked(!liked);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleDoubleTap = () => {
    if (!liked) {
      setLiked(true);
      setLikeCount(prev => prev + 1);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }
  };

  return (
    <View style={[styles.postContainer, { borderBottomColor: colors.border }]}>
      {/* Header */}
      <View style={styles.postHeader}>
        <View style={styles.postHeaderLeft}>
          <Image source={{ uri: post.user.avatar }} style={styles.postAvatar} />
          <View>
            <Text style={[styles.postUsername, { color: colors.text }]}>{post.user.username}</Text>
          </View>
        </View>
        <TouchableOpacity>
          <MoreHorizontal size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Image */}
      {post.imageUrl ? (
        <TouchableOpacity activeOpacity={0.95} onPress={handleDoubleTap}>
          <Image
            source={{ uri: post.imageUrl }}
            style={[styles.postImage, { height: POST_IMAGE_HEIGHT }]}
            resizeMode="cover"
          />
        </TouchableOpacity>
      ) : (
        <View style={[styles.textOnlyPost, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.textOnlyContent, { color: colors.text }]}>{post.content}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.postActions}>
        <View style={styles.postActionsLeft}>
          <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
            <Heart
              size={24}
              color={liked ? '#ED4956' : colors.text}
              fill={liked ? '#ED4956' : 'none'}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <MessageCircle size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Send size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => setSaved(!saved)}>
          <Bookmark
            size={24}
            color={colors.text}
            fill={saved ? colors.text : 'none'}
          />
        </TouchableOpacity>
      </View>

      {/* Likes */}
      {likeCount > 0 && (
        <View style={styles.likesRow}>
          <Text style={[styles.likesText, { color: colors.text }]}>
            {likeCount.toLocaleString()} {likeCount === 1 ? 'like' : 'likes'}
          </Text>
        </View>
      )}

      {/* Caption */}
      {post.imageUrl && (
        <View style={styles.captionRow}>
          <Text style={[styles.captionUsername, { color: colors.text }]}>
            {post.user.username}
          </Text>
          <Text style={[styles.captionText, { color: colors.text }]} numberOfLines={showFullCaption ? undefined : 2}>
            {' '}{post.content}
          </Text>
          {captionLong && (
            <TouchableOpacity onPress={() => setShowFullCaption(!showFullCaption)}>
              <Text style={[styles.moreText, { color: colors.textTertiary }]}>
                {showFullCaption ? ' less' : ' more'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Comments */}
      {post.comments > 0 && (
        <TouchableOpacity style={styles.commentsPreview}>
          <Text style={[styles.commentsText, { color: colors.textTertiary }]}>
            View {post.comments > 1 ? `all ${post.comments} comments` : '1 comment'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Timestamp */}
      <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
        {post.timestamp}
      </Text>
    </View>
  );
}

export default function FeedScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { showTabBar, hideTabBar } = useTabBar();
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);

  const stories = React.useMemo(() => mockStories.slice(0, 10), []);
  const posts = React.useMemo(() => mockPosts.slice(0, 20), []);

  const handleScroll = useCallback(
    (event: any) => {
      const currentOffset = event.nativeEvent.contentOffset.y;
      const direction = currentOffset > (handleScroll as any).lastOffset ? 'down' : 'up';
      (handleScroll as any).lastOffset = currentOffset;

      if (direction === 'down' && currentOffset > 50) {
        hideTabBar();
      } else if (direction === 'up') {
        showTabBar();
      }
    },
    [hideTabBar, showTabBar]
  );
  (handleScroll as any).lastOffset = 0;

  const renderHeader = () => (
    <View>
      {/* Header bar */}
      <View style={[styles.feedHeader, { paddingTop: insets.top + 8, backgroundColor: colors.background }]}>
        <Text style={[styles.feedHeaderTitle, { color: colors.text }]}>Feed</Text>
        <View style={styles.feedHeaderActions}>
          <TouchableOpacity style={styles.headerAction}>
            <Plus size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerAction, { marginLeft: 4 }]}>
            <Send size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stories */}
      <View style={[styles.storiesContainer, { backgroundColor: colors.background }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storiesScroll}
        >
          <StoryCircle story={{ id: 'add', user: stories[0]?.user, viewed: false, isLive: false, imageUrl: '' } as any} isFirst />
          {stories.map((story) => (
            <StoryCircle key={story.id} story={story} isFirst={false} />
          ))}
        </ScrollView>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: Post }) => <PostCard post={item} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={posts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderHeader}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  feedHeaderTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  feedHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAction: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storiesContainer: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  storiesScroll: {
    paddingHorizontal: 12,
    gap: 4,
  },
  storyItem: {
    alignItems: 'center',
    marginHorizontal: 6,
    width: 72,
  },
  storyRing: {
    width: STORY_SIZE + STORY_RING * 2,
    height: STORY_SIZE + STORY_RING * 2,
    borderRadius: (STORY_SIZE + STORY_RING * 2) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyImageWrapper: {
    width: STORY_SIZE,
    height: STORY_SIZE,
    borderRadius: STORY_SIZE / 2,
    borderWidth: 2,
    overflow: 'hidden',
  },
  storyImage: {
    width: '100%',
    height: '100%',
  },
  addStoryContainer: {
    alignItems: 'center',
  },
  addStoryBadge: {
    position: 'absolute',
    bottom: 18,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000',
    zIndex: 2,
  },
  storyName: {
    fontSize: 11,
    marginTop: 4,
  },
  liveBadge: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  liveText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  postContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 8,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  postHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  postAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  postUsername: {
    fontSize: 14,
    fontWeight: '700',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  locationText: {
    fontSize: 11,
  },
  postImage: {
    width: SCREEN_WIDTH,
  },
  textOnlyPost: {
    minHeight: 200,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textOnlyContent: {
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
    fontWeight: '500',
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  postActionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
  likesRow: {
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  likesText: {
    fontSize: 14,
    fontWeight: '700',
  },
  captionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  captionUsername: {
    fontSize: 14,
    fontWeight: '700',
  },
  captionText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 19,
  },
  moreText: {
    fontSize: 14,
  },
  commentsPreview: {
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  commentsText: {
    fontSize: 14,
  },
  timestamp: {
    fontSize: 11,
    paddingHorizontal: 12,
    paddingTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
