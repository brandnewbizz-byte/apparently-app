import React from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, MessageCircle, Play } from 'lucide-react-native';
import type { ProfilePost } from '@/lib/profilePosts';

const COLS = 3;
const GAP = 2;

const TEXT_GRADIENTS: [string, string][] = [
  ['#667eea', '#764ba2'],
  ['#f093fb', '#f5576c'],
  ['#4facfe', '#00c6fb'],
  ['#43e97b', '#38a169'],
  ['#fa709a', '#fee140'],
  ['#30cfd0', '#330867'],
];

/** Stable gradient per post so a text post always looks the same. */
export function textGradientFor(id: string): [string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TEXT_GRADIENTS[h % TEXT_GRADIENTS.length];
}

function Tile({ post, size, onPress }: { post: ProfilePost; size: number; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={{ width: size, height: size }} accessibilityLabel={post.caption ? `Post: ${post.caption.slice(0, 40)}` : 'Open post'}>
      {post.imageUrl ? (
        <Image source={{ uri: post.imageUrl }} style={styles.fill} resizeMode="cover" />
      ) : post.isVideo ? (
        <View style={[styles.fill, styles.videoTile]}>
          <Play size={28} color="rgba(255,255,255,0.9)" fill="rgba(255,255,255,0.9)" />
        </View>
      ) : (
        <LinearGradient colors={textGradientFor(post.id)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.fill, styles.textTile]}>
          <Text style={styles.textTileText} numberOfLines={5}>{post.caption}</Text>
        </LinearGradient>
      )}

      {post.isVideo ? (
        <View style={styles.cornerBadge}><Play size={13} color="#FFF" fill="#FFF" /></View>
      ) : null}

      {post.likeCount > 0 || post.commentCount > 0 ? (
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={styles.statsBar}>
          {post.likeCount > 0 ? (
            <View style={styles.stat}><Heart size={12} color="#FFF" fill="#FFF" /><Text style={styles.statText}>{post.likeCount}</Text></View>
          ) : null}
          {post.commentCount > 0 ? (
            <View style={styles.stat}><MessageCircle size={12} color="#FFF" fill="#FFF" /><Text style={styles.statText}>{post.commentCount}</Text></View>
          ) : null}
        </LinearGradient>
      ) : null}
    </TouchableOpacity>
  );
}

export default function PostGrid({ posts, onPostPress }: { posts: ProfilePost[]; onPostPress: (index: number) => void }) {
  const size = Math.floor((Dimensions.get('window').width - GAP * (COLS - 1)) / COLS);
  return (
    <View style={styles.grid}>
      {posts.map((p, i) => (
        <View key={p.id} style={{ marginRight: i % COLS < COLS - 1 ? GAP : 0, marginBottom: GAP }}>
          <Tile post={p} size={size} onPress={() => onPostPress(i)} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  fill: { width: '100%', height: '100%', backgroundColor: '#1a1a2e' },
  videoTile: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  textTile: { padding: 10, justifyContent: 'center' },
  textTileText: { color: '#FFF', fontSize: 13, fontWeight: '700', lineHeight: 17 },
  cornerBadge: { position: 'absolute', top: 6, right: 6 },
  statsBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 7, paddingTop: 14, paddingBottom: 5 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
});
