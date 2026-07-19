import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  ImageBackground,
  Platform,
  Pressable,
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

const viewer = {
  id: 'local-viewer',
  name: 'You',
  username: 'you',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160&h=160&fit=crop',
  isVerified: false,
  followersCount: 0,
};

function PulseGlyph({ active, color }: { active?: boolean; color: string }) {
  return (
    <View style={styles.pulseGlyph}>
      <View style={[styles.pulseGlyphOuter, { borderColor: color, opacity: active ? 1 : 0.7 }]} />
      <View style={[styles.pulseGlyphInner, { backgroundColor: color }]} />
    </View>
  );
}

function EchoGlyph({ color }: { color: string }) {
  return (
    <View style={styles.echoGlyph}>
      <View style={[styles.echoDot, { backgroundColor: color }]} />
      <View style={[styles.echoLineLong, { backgroundColor: color }]} />
      <View style={[styles.echoLineShort, { backgroundColor: color }]} />
    </View>
  );
}

function DriftGlyph({ color }: { color: string }) {
  return (
    <View style={styles.driftGlyph}>
      <View style={[styles.driftDotTop, { backgroundColor: color }]} />
      <View style={[styles.driftConnector, { backgroundColor: color }]} />
      <View style={[styles.driftDotBottom, { backgroundColor: color }]} />
    </View>
  );
}

function VaultGlyph({ active, color }: { active?: boolean; color: string }) {
  return (
    <View style={[styles.vaultGlyph, { borderColor: color }]}> 
      <View style={[styles.vaultGlyphStripe, { backgroundColor: active ? color : 'transparent', borderColor: color }]} />
    </View>
  );
}

function ReactionChip({
  label,
  count,
  active,
  colors,
  glyph,
  onPress,
}: {
  label: string;
  count: number;
  active?: boolean;
  colors: any;
  glyph: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.reactionChip,
        {
          backgroundColor: active ? colors.accentGlow : colors.backgroundSecondary,
          borderColor: active ? colors.accent : colors.border,
        },
      ]}
    >
      {glyph}
      <Text style={[styles.reactionChipLabel, { color: active ? colors.accent : colors.text }]}>{label}</Text>
      <Text style={[styles.reactionChipCount, { color: active ? colors.accent : colors.textSecondary }]}>{count}</Text>
    </TouchableOpacity>
  );
}

function WaveCard({ story, colors }: { story: Story; colors: any }) {
  return (
    <TouchableOpacity activeOpacity={0.88} style={[styles.waveCard, { borderColor: colors.border }]}> 
      <ImageBackground
        source={{ uri: story.imageUrl || story.user.avatar }}
        style={styles.waveCardImage}
        imageStyle={styles.waveCardImageInner}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.68)']}
          style={styles.waveCardOverlay}
        >
          <View style={styles.waveMetaTop}>
            <View style={[styles.waveBadge, { backgroundColor: story.viewed ? 'rgba(255,255,255,0.18)' : '#1F8BFF' }]}> 
              <Text style={styles.waveBadgeText}>{story.viewed ? 'Seen' : 'Now'}</Text>
            </View>
          </View>
          <View style={styles.waveMetaBottom}>
            <Image source={{ uri: story.user.avatar }} style={styles.waveAvatar} />
            <View style={styles.waveTextWrap}>
              <Text style={styles.waveUser} numberOfLines={1}>{story.user.username}</Text>
              <Text style={styles.waveTime}>{story.timestamp}</Text>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </TouchableOpacity>
  );
}

function PulseCard({
  post,
  colors,
  liked,
  saved,
  pulseCount,
  onToggleLike,
  onToggleSave,
}: {
  post: Post;
  colors: any;
  liked: boolean;
  saved: boolean;
  pulseCount: number;
  onToggleLike: () => void;
  onToggleSave: () => void;
}) {
  const hasImage = Boolean(post.imageUrl);

  return (
    <View style={[styles.pulseCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
      <View style={styles.pulseCardTopRow}>
        <View style={styles.pulseAuthorRow}>
          <Image source={{ uri: post.user.avatar }} style={styles.pulseAuthorAvatar} />
          <View style={styles.pulseAuthorTextWrap}>
            <Text style={[styles.pulseAuthorName, { color: colors.text }]}>{post.user.name}</Text>
            <Text style={[styles.pulseAuthorHandle, { color: colors.textSecondary }]}>@{post.user.username}</Text>
          </View>
        </View>
        <View style={styles.pulseTagStack}>
          {post.isApparently && post.apparentlyTag ? (
            <View style={[styles.postTagPill, { backgroundColor: colors.accentGlow, borderColor: colors.accent }]}> 
              <Text style={[styles.postTagPillText, { color: colors.accent }]}>{post.apparentlyTag}</Text>
            </View>
          ) : null}
          <Text style={[styles.pulseTimestamp, { color: colors.textTertiary }]}>{post.timestamp}</Text>
        </View>
      </View>

      <View style={[styles.pulseBody, !hasImage && styles.pulseBodyNoImage]}>
        <View style={styles.pulseCopyWrap}>
          <View style={[styles.signalPill, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}> 
            <View style={[styles.signalPillDot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.signalPillText, { color: colors.textSecondary }]}>Fresh signal</Text>
          </View>
          <Text style={[styles.pulseHeadline, { color: colors.text }]} numberOfLines={hasImage ? 4 : 7}>
            {post.content}
          </Text>
        </View>

        {hasImage ? (
          <Image source={{ uri: post.imageUrl }} style={styles.pulseSideImage} resizeMode="cover" />
        ) : null}
      </View>

      <View style={styles.pulseFooterRow}>
        <ReactionChip
          label="Pulse"
          count={pulseCount}
          active={liked}
          colors={colors}
          glyph={<PulseGlyph active={liked} color={liked ? colors.accent : colors.textSecondary} />}
          onPress={onToggleLike}
        />
        <ReactionChip
          label="Echo"
          count={post.comments}
          colors={colors}
          glyph={<EchoGlyph color={colors.textSecondary} />}
        />
        <ReactionChip
          label="Drift"
          count={post.shares}
          colors={colors}
          glyph={<DriftGlyph color={colors.textSecondary} />}
        />
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onToggleSave}
          style={[
            styles.saveButton,
            {
              backgroundColor: saved ? colors.accentGlow : colors.backgroundSecondary,
              borderColor: saved ? colors.accent : colors.border,
            },
          ]}
        >
          <VaultGlyph active={saved} color={saved ? colors.accent : colors.textSecondary} />
        </TouchableOpacity>
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
  const [pulseCounts, setPulseCounts] = useState<Record<string, number>>({});
  const lastOffsetRef = useRef(0);

  const socialPosts = getAllPosts();
  const socialStories = getAllStories();

  const basePosts = socialPosts.length ? socialPosts : mockPosts;
  const stories = useMemo(() => (socialStories.length ? socialStories : mockStories).slice(0, 10), [socialStories]);
  const posts = useMemo(() => [...localPosts, ...basePosts], [localPosts, basePosts]);

  const pulseCountFor = useCallback((post: Post) => pulseCounts[post.id] ?? post.likes, [pulseCounts]);

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  };

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

    setLocalPosts(prev => [optimisticPost, ...prev]);
    setDraft('');
    createPost(clean);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
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
    setLikedMap(prev => ({ ...prev, [post.id]: nextLiked }));
    setPulseCounts(prev => ({
      ...prev,
      [post.id]: (prev[post.id] ?? post.likes) + (nextLiked ? 1 : -1),
    }));
    triggerHaptic();
  }, [likedMap]);

  const toggleSave = useCallback((postId: string) => {
    setSavedMap(prev => ({ ...prev, [postId]: !prev[postId] }));
    triggerHaptic();
  }, []);

  const header = (
    <View>
      <LinearGradient
        colors={[colors.background, colors.backgroundSecondary]}
        style={[styles.headerShell, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}
      >
        <View style={styles.headerTopRow}>
          <View>
            <Text style={[styles.headerEyebrow, { color: colors.textSecondary }]}>SOCIAL FEED</Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Pulse Board</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              Drop updates, spot momentum, and keep your circle moving.
            </Text>
          </View>
          <View style={styles.headerGlyphCluster}>
            <View style={[styles.headerGlyphBubble, { backgroundColor: colors.accentGlow, borderColor: colors.accent }]}>
              <PulseGlyph active color={colors.accent} />
            </View>
            <View style={[styles.headerGlyphBubble, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <EchoGlyph color={colors.textSecondary} />
            </View>
          </View>
        </View>

        <View style={[styles.composerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <View style={styles.composerTopRow}>
            <Image source={{ uri: viewer.avatar }} style={styles.composerAvatar} />
            <View style={styles.composerPromptWrap}>
              <Text style={[styles.composerPromptTitle, { color: colors.text }]}>What are you building right now?</Text>
              <Text style={[styles.composerPromptSubtitle, { color: colors.textSecondary }]}>Keep it quick, visual, or straight to the point.</Text>
            </View>
          </View>
          <TextInput
            multiline
            placeholder="Drop a win, ask for help, or share a moment..."
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
            <View style={styles.composerModes}>
              {['Photo', 'Ask', 'Win'].map((mode, index) => (
                <View
                  key={mode}
                  style={[
                    styles.modeChip,
                    {
                      backgroundColor: index === 0 ? colors.accentGlow : colors.backgroundSecondary,
                      borderColor: index === 0 ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.modeChipText, { color: index === 0 ? colors.accent : colors.textSecondary }]}>{mode}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handlePublish}
              style={[styles.publishButton, { backgroundColor: colors.text }]}
            >
              <Text style={[styles.publishButtonText, { color: colors.background }]}>Post</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Current waves</Text>
          <Text style={[styles.sectionCaption, { color: colors.textSecondary }]}>Fast snapshots from your people</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.waveScrollContent}>
          {stories.map((story) => (
            <WaveCard key={story.id} story={story} colors={colors} />
          ))}
        </ScrollView>
      </View>

      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeaderRowCompact}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Fresh signals</Text>
            <Text style={[styles.sectionCaption, { color: colors.textSecondary }]}>A cleaner, card-first layout built for this app</Text>
          </View>
          <View style={[styles.liveStrip, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}> 
            <View style={[styles.liveStripDot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.liveStripText, { color: colors.textSecondary }]}>{posts.length} drops</Text>
          </View>
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
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        renderItem={({ item }) => (
          <PulseCard
            post={item}
            colors={colors}
            liked={Boolean(likedMap[item.id])}
            saved={Boolean(savedMap[item.id])}
            pulseCount={pulseCountFor(item)}
            onToggleLike={() => toggleLike(item)}
            onToggleSave={() => toggleSave(item.id)}
          />
        )}
      />
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
    gap: 16,
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
    maxWidth: 260,
  },
  headerGlyphCluster: {
    flexDirection: 'column',
    gap: 10,
    paddingTop: 6,
  },
  headerGlyphBubble: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  composerModes: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  modeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
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
  sectionHeaderRowCompact: {
    paddingHorizontal: 18,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
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
  waveScrollContent: {
    paddingHorizontal: 18,
    gap: 12,
    paddingBottom: 4,
  },
  waveCard: {
    width: 148,
    height: 188,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    marginRight: 12,
  },
  waveCardImage: {
    flex: 1,
  },
  waveCardImageInner: {
    borderRadius: 26,
  },
  waveCardOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 14,
  },
  waveMetaTop: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  waveMetaBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  waveBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  waveBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  waveAvatar: {
    width: 34,
    height: 34,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  waveTextWrap: {
    flex: 1,
  },
  waveUser: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  waveTime: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    marginTop: 2,
  },
  liveStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  liveStripDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveStripText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pulseCard: {
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 28,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
  pulseCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  pulseAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  pulseAuthorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 18,
  },
  pulseAuthorTextWrap: {
    flex: 1,
  },
  pulseAuthorName: {
    fontSize: 15,
    fontWeight: '700',
  },
  pulseAuthorHandle: {
    marginTop: 2,
    fontSize: 12,
  },
  pulseTagStack: {
    alignItems: 'flex-end',
    gap: 8,
  },
  postTagPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  postTagPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  pulseTimestamp: {
    fontSize: 11,
    fontWeight: '600',
  },
  pulseBody: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'stretch',
  },
  pulseBodyNoImage: {
    flexDirection: 'column',
  },
  pulseCopyWrap: {
    flex: 1,
    gap: 12,
  },
  signalPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  signalPillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  signalPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pulseHeadline: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
  },
  pulseSideImage: {
    width: 118,
    minHeight: 138,
    borderRadius: 22,
  },
  pulseFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  reactionChipLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  reactionChipCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  saveButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  pulseGlyph: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseGlyphOuter: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  pulseGlyphInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  echoGlyph: {
    width: 16,
    height: 16,
    justifyContent: 'center',
  },
  echoDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    left: 0,
    top: 6,
  },
  echoLineLong: {
    position: 'absolute',
    left: 6,
    top: 4,
    width: 10,
    height: 3,
    borderRadius: 99,
  },
  echoLineShort: {
    position: 'absolute',
    left: 6,
    top: 9,
    width: 7,
    height: 3,
    borderRadius: 99,
  },
  driftGlyph: {
    width: 16,
    height: 16,
    position: 'relative',
  },
  driftDotTop: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    top: 1,
    left: 1,
  },
  driftConnector: {
    position: 'absolute',
    width: 9,
    height: 2,
    transform: [{ rotate: '38deg' }],
    top: 7,
    left: 3,
    borderRadius: 99,
  },
  driftDotBottom: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    bottom: 1,
    right: 1,
  },
  vaultGlyph: {
    width: 14,
    height: 16,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vaultGlyphStripe: {
    width: 8,
    height: 2,
    borderRadius: 99,
    borderWidth: 1,
  },
});
