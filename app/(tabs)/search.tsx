import {
  Search as SearchIcon, X, UserPlus, UserCheck, AtSign, Hash, Clock, Zap,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Dimensions, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Types ──

interface UserResult {
  id: string;
  name: string;
  username: string;
  avatar: string;
  is_verified: boolean;
  bio?: string;
  followers_count?: number;
}

// Maps profile row (full_name, avatar) to UserResult (name, avatar)
interface ProfileRow {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar: string | null;
  bio?: string | null;
}

interface PostResult {
  id: string;
  content: string;
  image_url?: string;
  user_id: string;
  created_at: string;
  likes: number;
  comments: number;
  post_kind: string;
  user: { name: string; username: string; avatar: string; is_verified: boolean };
}

type TabKey = 'top' | 'users' | 'posts';

// ── Helpers ──

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  if (hrs < 24) return `${hrs}h`;
  return `${days}d`;
}

// ── Component ──

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { user: currentUser } = useAuth();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('top');
  const [users, setUsers] = useState<UserResult[]>([]);
  const [posts, setPosts] = useState<PostResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followLoading, setFollowLoading] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef(0);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setUsers([]);
      setPosts([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);

    const trimmed = q.trim();
    const pattern = `%${trimmed}%`;
    const isHashtag = trimmed.startsWith('#');
    const seq = ++requestSeqRef.current;

    try {
      // For hashtag searches, only search posts (hashtags aren't users)
      const userPromise = isHashtag
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from('profiles')
            .select('id, full_name, username, avatar, bio, email')
            .or(`full_name.ilike.${pattern},username.ilike.${pattern},email.ilike.${pattern}`)
            .limit(20);

      const postPattern = `%${trimmed}%`;
      const postPromise = supabase
        .from('posts')
        .select(`
          id, content, image_url, user_id, created_at, likes, comments, post_kind,
          user:user_id(name, username, avatar, is_verified)
        `)
        .ilike('content', postPattern)
        .or('post_kind.is.null,post_kind.not.in.(bundle,service,skill)')
        .order('created_at', { ascending: false })
        .limit(20);

      const [userRes, postRes] = await Promise.all([userPromise, postPromise]);

      // Reject stale results — newer request already in flight
      if (seq !== requestSeqRef.current) return;

      if (!userRes.error) {
        // Map profiles rows to UserResult shape
        const mapped: UserResult[] = ((userRes.data as ProfileRow[]) || []).map(p => ({
          id: p.id,
          name: p.full_name || p.username || 'User',
          username: p.username || '',
          avatar: p.avatar || '',
          is_verified: false,
          bio: p.bio || undefined,
        }));
        setUsers(mapped);
        // Load following status for found users
        if (mapped.length > 0 && currentUser?.id) {
          const userIds = mapped.map(u => u.id);
          supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', currentUser.id)
            .in('following_id', userIds)
            .then(({ data: followData }) => {
              if (followData) {
                setFollowingIds(new Set(followData.map((f: any) => f.following_id)));
              }
            }, (err: any) => {
              console.error('[Search] Follow status fetch error:', err);
            });
        }
      }
      if (!postRes.error) setPosts((postRes.data as unknown as PostResult[]) || []);
    } catch (err) {
      console.error('[Search] Error:', err);
    } finally {
      if (seq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, [currentUser?.id]);

  // Reload following status when currentUser becomes available or search results change
  useEffect(() => {
    if (!currentUser?.id || users.length === 0) return;
    const userIds = users.map(u => u.id);
    supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentUser.id)
      .in('following_id', userIds)
      .then(({ data: followData }) => {
        if (followData) {
          setFollowingIds(new Set(followData.map((f: any) => f.following_id)));
        }
      }, (err: any) => {
        console.error('[Search] Follow status fetch error:', err);
      });
  }, [currentUser?.id, users]);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(text), 350);
  };

  const handleClear = () => {
    setQuery('');
    setUsers([]);
    setPosts([]);
    setHasSearched(false);
    inputRef.current?.focus();
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleUserPress = (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/user/${userId}` as any);
  };

  const handlePostPress = (postId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/post/${postId}` as any);
  };

  const handleToggleFollow = async (targetUserId: string) => {
    if (!currentUser?.id || followLoading) return;
    setFollowLoading(targetUserId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const isFollowing = followingIds.has(targetUserId);
    // Snapshot for rollback
    const previousIds = new Set(followingIds);

    const newIds = new Set(previousIds);
    if (isFollowing) {
      newIds.delete(targetUserId);
    } else {
      newIds.add(targetUserId);
    }
    setFollowingIds(newIds);

    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', targetUserId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: currentUser.id, following_id: targetUserId });
        if (error) throw error;
      }
    } catch (err) {
      console.error('[Search] Follow error:', err);
      // Rollback to previous state on failure
      setFollowingIds(previousIds);
      Alert.alert('Error', 'Failed to update follow status. Please try again.');
    } finally {
      setFollowLoading(null);
    }
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'top', label: 'Top' },
    { key: 'users', label: 'Users' },
    { key: 'posts', label: 'Posts' },
  ];

  const tabCounts = useMemo(() => ({
    top: users.length + posts.length,
    users: users.length,
    posts: posts.length,
  }), [users, posts]);

  const renderUserRow = ({ item }: { item: UserResult }) => {
    const isFollowing = followingIds.has(item.id);
    const isMe = currentUser?.id === item.id;
    return (
    <TouchableOpacity style={styles.resultRow} onPress={() => handleUserPress(item.id)} activeOpacity={0.6}>
      <Image source={{ uri: item.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200' }} style={styles.avatar} />
      <View style={styles.resultText}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
          {item.is_verified && <Zap size={14} color={colors.accent} />}
        </View>
        <Text style={[styles.username, { color: colors.textTertiary }]}>
          @{item.username}{item.followers_count != null ? ` · ${item.followers_count} followers` : ''}
        </Text>
        {item.bio ? (
          <Text style={[styles.bio, { color: colors.textSecondary }]} numberOfLines={1}>{item.bio}</Text>
        ) : null}
      </View>
      {!isMe && (
        <TouchableOpacity
          style={[styles.followBtn, isFollowing ? styles.followingBtn : { backgroundColor: colors.accent }]}
          onPress={(e) => { e.stopPropagation(); handleToggleFollow(item.id); }}
          disabled={followLoading === item.id}
        >
          {followLoading === item.id ? (
            <ActivityIndicator size="small" color={isFollowing ? colors.text : '#FFF'} />
          ) : isFollowing ? (
            <UserCheck size={18} color={colors.text} />
          ) : (
            <UserPlus size={18} color="#FFF" />
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
  };

  const renderPostRow = ({ item }: { item: PostResult }) => {
    const avatar = item.user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100';
    return (
      <TouchableOpacity style={styles.resultRow} onPress={() => handlePostPress(item.id)} activeOpacity={0.6}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.postThumb} />
        ) : (
          <View style={[styles.postThumbEmpty, { backgroundColor: colors.surface }]}>
            <Hash size={20} color={colors.textTertiary} />
          </View>
        )}
        <View style={styles.resultText}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.user?.name || 'User'}</Text>
            <AtSign size={12} color={colors.textTertiary} />
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>{item.user?.username || 'unknown'}</Text>
          </View>
          <Text style={[styles.postPreview, { color: colors.textSecondary }]} numberOfLines={2}>{item.content}</Text>
          <View style={styles.postMeta}>
            <Clock size={11} color={colors.textTertiary} />
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>{timeAgo(item.created_at)}</Text>
            <Text style={[styles.metaTextDot, { color: colors.textTertiary }]}>·</Text>
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>{item.likes ?? 0} likes</Text>
            <Text style={[styles.metaTextDot, { color: colors.textTertiary }]}>·</Text>
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>{item.comments ?? 0} comments</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const mixedResults = useMemo(() => {
    const result: Array<{ type: 'user' | 'post'; data: any }> = [];
    const maxLen = Math.max(users.length, posts.length);
    for (let i = 0; i < maxLen; i++) {
      if (users[i]) result.push({ type: 'user', data: users[i] });
      if (posts[i]) result.push({ type: 'post', data: posts[i] });
    }
    return result;
  }, [users, posts]);

  const getListData = () => {
    switch (activeTab) {
      case 'users': return users;
      case 'posts': return posts;
      default: return mixedResults;
    }
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    if (activeTab === 'users') return renderUserRow({ item, index } as any);
    if (activeTab === 'posts') return renderPostRow({ item, index } as any);
    return item.type === 'user' ? renderUserRow({ item: item.data } as any) : renderPostRow({ item: item.data } as any);
  };

  const keyExtractor = (item: any, index: number) =>
    item.type ? `${item.type}-${item.data?.id || index}` : (item.id || String(index));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SearchIcon size={18} color={colors.textTertiary} style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.text }]}
            placeholder="Search users, posts, #hashtags..."
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={handleQueryChange}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            onSubmitEditing={() => doSearch(query)}
          />
          {query.length > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
              <X size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      {hasSearched && (
        <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, isActive && { borderBottomColor: colors.accent }]}
                onPress={() => { setActiveTab(tab.key); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.tabLabel, { color: isActive ? colors.accent : colors.textTertiary }]}>
                  {tab.label}
                </Text>
                <Text style={[styles.tabCount, { color: isActive ? colors.accent : colors.textTertiary }]}>
                  {tabCounts[tab.key]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Results */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : !hasSearched ? (
        <View style={styles.centered}>
          <SearchIcon size={48} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
            Discover people and posts
          </Text>
          <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
            Search for friends, creators, and trending content
          </Text>
        </View>
      ) : (
        <FlatList
          data={getListData()}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
                No results found
              </Text>
              <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
                Try a different search term
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 12,
    borderWidth: 1, paddingHorizontal: 12, height: 42,
  },
  searchIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 16, paddingVertical: 0 },
  clearBtn: { padding: 4, marginLeft: 4 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 0.5, paddingHorizontal: 16 },
  tab: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    marginRight: 24, borderBottomWidth: 2, borderBottomColor: 'transparent', gap: 4,
  },
  tabLabel: { fontSize: 14, fontWeight: '600' },
  tabCount: { fontSize: 12, fontWeight: '500' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginTop: 16 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#222' },
  postThumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#222' },
  postThumbEmpty: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  resultText: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontSize: 15, fontWeight: '600' },
  username: { fontSize: 13, marginTop: 1 },
  bio: { fontSize: 13, marginTop: 2 },
  postPreview: { fontSize: 14, lineHeight: 18, marginTop: 2 },
  postMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  metaText: { fontSize: 12 },
  metaTextDot: { fontSize: 12 },
  followBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  followingBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
});
