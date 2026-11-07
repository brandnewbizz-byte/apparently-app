/**
 * FeedGrid — the Feed's Pinterest-style home: two columns of posts
 * ("masonry"), each tile keeping its own shape, so you see many posts at once.
 * Tapping a tile opens that post full screen (the regular feed, with live,
 * likes, comments and everything else) — see app/(tabs)/feed/index.tsx.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Image as RNImage, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import { Play, User } from 'lucide-react-native';
import VideoPoster from '@/components/VideoPoster';
import { isVideoUrl } from '@/lib/media';

export interface GridPost {
  id: string;
  type?: string;
  caption: string;
  media?: string;
  mediaWidth?: number;
  mediaHeight?: number;
  videoUrl?: string;
  author: { name: string; avatar: string; userId?: string };
}

const GAP = 8;
const SIDE = 8;
const RADIUS = 16;
/** Shapes we show tiles in (height ÷ width), like Pinterest: never too flat or too tall. */
const MIN_RATIO = 0.75;
const MAX_RATIO = 1.9;
const VIDEO_RATIO = 16 / 9;

const ratioCache = new Map<string, number>();

function isVideoPost(p: GridPost) {
  return p.type === 'video' && !!p.videoUrl;
}

function clampRatio(r: number) {
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, r));
}

/** Best guess of a tile's shape before (or without) loading its image. */
function guessRatio(p: GridPost): number {
  if (p.mediaWidth && p.mediaHeight) return clampRatio(p.mediaHeight / p.mediaWidth);
  if (p.media && ratioCache.has(p.media)) return ratioCache.get(p.media)!;
  if (isVideoPost(p)) return VIDEO_RATIO;
  if (!p.media) return 0; // text post: sized by its words
  return 1.3;
}

function Tile({ post, width, colors, onPress }: {
  post: GridPost;
  width: number;
  colors: any;
  onPress: () => void;
}) {
  const video = isVideoPost(post);
  const cover = post.media && post.media !== post.videoUrl && !isVideoUrl(post.media) ? post.media : undefined;
  const [ratio, setRatio] = useState(() => guessRatio(post));

  useEffect(() => {
    const img = video ? cover : post.media;
    if (!img || (post.mediaWidth && post.mediaHeight)) return;
    if (ratioCache.has(img)) { setRatio(ratioCache.get(img)!); return; }
    let alive = true;
    RNImage.getSize(img, (w, h) => {
      if (!w || !h) return;
      const r = clampRatio(h / w);
      ratioCache.set(img, r);
      if (alive) setRatio(r);
    }, () => {});
    return () => { alive = false; };
  }, [post.media, cover, video, post.mediaWidth, post.mediaHeight]);

  const caption = (post.caption || '').trim();
  const mediaH = Math.round(width * (ratio || 1.3));

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ width, marginBottom: 14, opacity: pressed ? 0.85 : 1 }]}
      accessibilityLabel={`${video ? 'Video' : post.media ? 'Photo' : 'Post'} by ${post.author.name}${caption ? `: ${caption.slice(0, 60)}` : ''}`}>
      {post.media || video ? (
        <View style={[styles.mediaBox, { height: mediaH, backgroundColor: colors.surfaceHighlight || colors.surface }]}>
          {video && !cover ? (
            <VideoPoster videoUrl={post.videoUrl!} style={StyleSheet.absoluteFill as any} />
          ) : (
            <RNImage source={{ uri: (cover || post.media)! }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          )}
          {video ? (
            <View style={styles.playBadge} pointerEvents="none">
              <Play size={12} color="#FFF" fill="#FFF" />
            </View>
          ) : null}
        </View>
      ) : (
        // Text post: the words on a soft card.
        <View style={[styles.textBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.textBody, { color: colors.text }]} numberOfLines={8}>{caption || ' '}</Text>
        </View>
      )}
      {post.media && caption ? (
        <Text style={[styles.caption, { color: colors.text }]} numberOfLines={2}>{caption}</Text>
      ) : null}
      <View style={styles.authorRow}>
        {post.author.avatar ? (
          <RNImage source={{ uri: post.author.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }]}>
            <User size={11} color={colors.textTertiary} />
          </View>
        )}
        <Text style={[styles.author, { color: colors.textSecondary }]} numberOfLines={1}>{post.author.name}</Text>
      </View>
    </Pressable>
  );
}

export default function FeedGrid<T extends GridPost>({
  posts, colors, topPad, bottomPad, onOpen, onScroll, refreshControl, empty, scrollRef,
}: {
  posts: T[];
  colors: any;
  topPad: number;
  bottomPad: number;
  onOpen: (index: number) => void;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  refreshControl?: React.ReactElement<any>;
  empty?: React.ReactNode;
  scrollRef?: React.Ref<any>;
}) {
  const { width: screenW } = useWindowDimensions();
  const colW = Math.floor((Math.min(screenW, 900) - SIDE * 2 - GAP) / 2);

  // Each post goes in whichever column is shorter so far (Pinterest's "masonry").
  const columns = useMemo(() => {
    const cols: { post: T; index: number }[][] = [[], []];
    const h = [0, 0];
    posts.forEach((post, index) => {
      const r = guessRatio(post);
      const est = (r ? colW * r : 140) + (post.media && post.caption ? 40 : 0) + 34;
      const c = h[0] <= h[1] ? 0 : 1;
      cols[c].push({ post, index });
      h[c] += est;
    });
    return cols;
  }, [posts, colW]);

  return (
    <ScrollView
      ref={scrollRef}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      refreshControl={refreshControl}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad, paddingHorizontal: SIDE, alignItems: 'center' }}
    >
      {posts.length === 0 ? empty : (
        <View style={{ flexDirection: 'row', gap: GAP, alignItems: 'flex-start' }}>
          {columns.map((col, ci) => (
            <View key={ci} style={{ width: colW }}>
              {col.map(({ post, index }) => (
                <Tile key={post.id} post={post} width={colW} colors={colors} onPress={() => onOpen(index)} />
              ))}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  mediaBox: { width: '100%', borderRadius: RADIUS, overflow: 'hidden' },
  playBadge: {
    position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', paddingLeft: 2,
  },
  textBox: { borderRadius: RADIUS, borderWidth: StyleSheet.hairlineWidth, padding: 14, minHeight: 110 },
  textBody: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
  caption: { fontSize: 13, fontWeight: '600', marginTop: 6, paddingHorizontal: 2, lineHeight: 17 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingHorizontal: 2 },
  avatar: { width: 20, height: 20, borderRadius: 10 },
  author: { fontSize: 12, flexShrink: 1 },
});
