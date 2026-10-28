import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft, MoreHorizontal, Heart, MessageCircle, Send, Bookmark, Play, Edit3, Trash2, Flag, Repeat, X, User,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import * as api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useSocial } from '@/contexts/SocialContext';
import AppVideo from '@/components/AppVideo';
import CommentsSheet from '@/components/comments/CommentsSheet';
import { CommentAvatar } from '@/components/comments/CommentsPanel';
import { shortTimeAgo } from '@/components/comments/useComments';
import { setSaved, type ProfilePost } from '@/lib/profilePosts';
import { textGradientFor } from './PostGrid';

const haptic = (style = Haptics.ImpactFeedbackStyle.Light) => { if (Platform.OS !== 'web') Haptics.impactAsync(style); };

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

// ─────────────────────────────────────────────────────────────────────────────
// One page of the viewer
// ─────────────────────────────────────────────────────────────────────────────
function Page({
  post, active, chromeVisible, onToggleChrome, onOpenComments, onOpenProfile, onSavedChange, width, height, insets,
}: {
  post: ProfilePost; active: boolean; chromeVisible: boolean; onToggleChrome: () => void;
  onOpenComments: (post: ProfilePost) => void; onOpenProfile: (id: string) => void;
  onSavedChange?: (postId: string, saved: boolean) => void;
  width: number; height: number; insets: { top: number; bottom: number };
}) {
  const { user } = useAuth();
  const myId = user?.id || '';
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [saved, setSavedState] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [heartScale] = useState(() => new Animated.Value(0));
  const lastTap = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Real like/save state for this viewer, loaded when the page becomes active.
  useEffect(() => {
    if (!active || !myId) return;
    let alive = true;
    Promise.all([
      supabase.from('post_likes').select('id').eq('post_id', post.id).eq('user_id', myId).maybeSingle(),
      supabase.from('post_likes').select('id', { count: 'exact', head: true }).eq('post_id', post.id),
      supabase.from('saved_posts').select('id').eq('post_id', post.id).eq('user_id', myId).maybeSingle(),
    ]).then(([mine, total, sv]) => {
      if (!alive) return;
      setLiked(!!mine.data);
      if (typeof total.count === 'number') setLikeCount(total.count);
      setSavedState(!!sv.data);
    });
    return () => { alive = false; };
  }, [active, myId, post.id]);

  useEffect(() => () => { if (singleTapTimer.current) clearTimeout(singleTapTimer.current); }, []);

  const popHeart = () => {
    heartScale.setValue(0);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
      Animated.delay(350),
      Animated.timing(heartScale, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  };

  const setLike = useCallback(async (next: boolean) => {
    if (!myId) return;
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      await api.setLike(post.id, myId, next);
      if (next && post.userId !== myId) {
        const actorName = user?.fullName || user?.username || 'Someone';
        supabase.from('notifications').insert({
          user_id: post.userId, actor_id: myId, type: 'like',
          actor_name: actorName, actor_avatar: user?.avatar || '',
          title: `${actorName} liked your post`, body: 'liked your post',
          data: { post_id: post.id, post_image_url: post.imageUrl || '', post_user_id: post.userId },
          read: false, created_at: new Date().toISOString(),
        }).then(() => {});
      }
    } catch {
      setLiked(!next);
      setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
    }
  }, [myId, post, user]);

  const onMediaPress = () => {
    const now = Date.now();
    if (now - lastTap.current < 260) {
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      lastTap.current = 0;
      haptic(Haptics.ImpactFeedbackStyle.Medium);
      popHeart();
      if (!liked) setLike(true);
      return;
    }
    lastTap.current = now;
    singleTapTimer.current = setTimeout(onToggleChrome, 270);
  };

  const toggleSave = async () => {
    if (!myId) return;
    haptic();
    const next = !saved;
    setSavedState(next);
    const ok = await setSaved(myId, post.id, next);
    if (!ok) { setSavedState(!next); Alert.alert(next ? 'Could not save' : 'Could not unsave', 'Check your connection and try again.'); return; }
    onSavedChange?.(post.id, next);
  };

  const sharePost = () => {
    haptic();
    const link = post.videoUrl || post.imageUrl || '';
    const header = `${post.author.username ? '@' + post.author.username : post.author.name} on Apparently`;
    Share.share({ message: [header, post.caption, link].filter(Boolean).join('\n\n') }).catch(() => {});
  };

  const isTextOnly = !post.imageUrl && !post.videoUrl;
  const longCaption = post.caption.length > 110 || post.caption.split('\n').length > 2;

  return (
    <View style={{ width, height, backgroundColor: '#000' }}>
      {/* ── Media ── */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onMediaPress} accessibilityLabel="Double-tap to like">
        {post.isVideo && post.videoUrl ? (
          active ? (
            <AppVideo source={{ uri: post.videoUrl }} style={StyleSheet.absoluteFill} resizeMode="contain" shouldPlay isLooping />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.center]}>
              {post.imageUrl ? <Image source={{ uri: post.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="contain" /> : null}
              <Play size={48} color="rgba(255,255,255,0.85)" fill="rgba(255,255,255,0.85)" />
            </View>
          )
        ) : post.imageUrl ? (
          <Image source={{ uri: post.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="contain" />
        ) : (
          <LinearGradient colors={textGradientFor(post.id)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.textCard]}>
            <Text style={[styles.textCardBody, post.caption.length > 160 && { fontSize: 20, lineHeight: 28 }]} numberOfLines={14}>{post.caption}</Text>
          </LinearGradient>
        )}
      </Pressable>

      {/* ── Double-tap heart ── */}
      <Animated.View pointerEvents="none" style={[styles.center, StyleSheet.absoluteFill, { opacity: heartScale, transform: [{ scale: heartScale.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }]}>
        <Heart size={110} color="#FFF" fill="#FFF" />
      </Animated.View>

      {/* ── Bottom info panel ── */}
      {chromeVisible ? (
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.85)']}
          style={[styles.bottom, { paddingBottom: insets.bottom + 14 }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity style={styles.authorRow} onPress={() => onOpenProfile(post.author.id)} accessibilityLabel={`Open ${post.author.name}'s profile`}>
            <CommentAvatar uri={post.author.avatar} name={post.author.name} size={34} colors={{ accent: '#FFFFFF', surfaceHighlight: '#333' }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.authorName} numberOfLines={1}>{post.author.username || post.author.name}</Text>
              <Text style={styles.authorMeta}>{shortTimeAgo(post.createdAt) === 'now' ? 'Just now' : shortTimeAgo(post.createdAt)}</Text>
            </View>
          </TouchableOpacity>

          {post.caption && !isTextOnly ? (
            <Text style={styles.caption} numberOfLines={expanded ? undefined : 2} onPress={() => longCaption && setExpanded((e) => !e)}>
              {post.caption}
            </Text>
          ) : null}
          {longCaption && !expanded && !isTextOnly ? (
            <Text style={styles.more} onPress={() => setExpanded(true)}>more</Text>
          ) : null}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.action} onPress={() => { haptic(); if (!liked) popHeart(); setLike(!liked); }} accessibilityLabel={liked ? 'Unlike' : 'Like'}>
              <Heart size={26} color={liked ? '#FF3040' : '#FFF'} fill={liked ? '#FF3040' : 'none'} />
              <Text style={styles.actionText}>{likeCount > 0 ? formatCount(likeCount) : ''}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => onOpenComments(post)} accessibilityLabel="Comments">
              <MessageCircle size={25} color="#FFF" />
              <Text style={styles.actionText}>{post.commentCount > 0 ? formatCount(post.commentCount) : ''}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={sharePost} accessibilityLabel="Share">
              <Send size={23} color="#FFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={styles.action} onPress={toggleSave} accessibilityLabel={saved ? 'Remove from saved' : 'Save'}>
              <Bookmark size={24} color="#FFF" fill={saved ? '#FFF' : 'none'} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => onOpenComments(post)}>
            <Text style={styles.viewComments}>
              {post.commentCount > 0 ? `View ${post.commentCount === 1 ? '1 comment' : `all ${post.commentCount} comments`}` : 'Add a comment…'}
            </Text>
          </TouchableOpacity>
        </LinearGradient>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Viewer
// ─────────────────────────────────────────────────────────────────────────────
export interface PostViewerProps {
  visible: boolean;
  posts: ProfilePost[];
  initialIndex: number;
  title?: string;
  colors: any;
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
  onDeleted?: (postId: string) => void;
  onEdited?: (postId: string, caption: string) => void;
  onSavedChange?: (postId: string, saved: boolean) => void;
}

export default function PostViewer({
  visible, posts: inputPosts, initialIndex, title = 'Posts', colors, onClose, onOpenProfile, onDeleted, onEdited, onSavedChange,
}: PostViewerProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { deletePost: socialDeletePost, updatePost: socialUpdatePost } = useSocial();
  const { width, height } = Dimensions.get('window');
  const [posts, setPosts] = useState<ProfilePost[]>(inputPosts);
  const [index, setIndex] = useState(initialIndex);
  const [chrome, setChrome] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [commentsFor, setCommentsFor] = useState<ProfilePost | null>(null);

  useEffect(() => {
    if (visible) { setPosts(inputPosts); setIndex(initialIndex); setChrome(true); }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = posts[index];
  const isMine = !!current && current.userId === user?.id;

  const close = () => { setMenuOpen(false); setEditing(false); setCommentsFor(null); onClose(); };

  const goProfile = (id: string) => { close(); onOpenProfile(id); };

  const handleDelete = () => {
    if (!current) return;
    setMenuOpen(false);
    Alert.alert('Delete post?', 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('posts').delete().eq('id', current.id);
          if (error) { Alert.alert('Could not delete', 'Something went wrong. Please try again.'); return; }
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          socialDeletePost(current.id);
          onDeleted?.(current.id);
          const remaining = posts.filter((p) => p.id !== current.id);
          if (!remaining.length) { close(); return; }
          setPosts(remaining);
          setIndex((i) => Math.min(i, remaining.length - 1));
        },
      },
    ]);
  };

  const saveEdit = async () => {
    if (!current) return;
    const caption = editText.trim();
    if (!caption && !current.imageUrl && !current.videoUrl) { Alert.alert('Caption required', 'Text posts need some text.'); return; }
    setSavingEdit(true);
    const { error } = await supabase.from('posts').update({ content: caption }).eq('id', current.id);
    setSavingEdit(false);
    if (error) { Alert.alert('Could not update', 'Something went wrong saving your changes.'); return; }
    socialUpdatePost(current.id, caption);
    setPosts((prev) => prev.map((p) => (p.id === current.id ? { ...p, caption } : p)));
    onEdited?.(current.id, caption);
    setEditing(false);
  };

  const reshare = async () => {
    if (!current || !user?.id) return;
    setMenuOpen(false);
    const { error } = await supabase.from('posts').insert({
      user_id: user.id,
      content: JSON.stringify({ type: 'reshare', originalPostId: current.id, originalCaption: current.caption, originalAuthor: current.author.name }),
      image_url: current.imageUrl || current.videoUrl || '',
      post_kind: 'reshare', likes: 0, comments: 0, shares: 0,
    });
    Alert.alert(error ? 'Could not reshare' : 'Reshared', error ? 'Please try again.' : 'It’s now on your feed.');
  };

  const report = async () => {
    if (!current) return;
    setMenuOpen(false);
    const { error } = await supabase.from('reports').insert({ post_id: current.id, reported_by: user?.id || null, reason: 'Reported post' });
    Alert.alert(error ? 'Could not report' : 'Thanks for letting us know', error ? 'Please try again.' : 'We’ll review this post.');
  };

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={close}>
      <StatusBar barStyle="light-content" />
      <View style={styles.root}>
        {visible && posts.length > 0 ? (
          <FlatList
            data={posts}
            keyExtractor={(p) => p.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={Math.min(initialIndex, posts.length - 1)}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
            windowSize={3}
            initialNumToRender={1}
            renderItem={({ item, index: i }) => (
              <Page
                post={item}
                active={i === index}
                chromeVisible={chrome}
                onToggleChrome={() => setChrome((c) => !c)}
                onOpenComments={setCommentsFor}
                onOpenProfile={goProfile}
                onSavedChange={onSavedChange}
                width={width}
                height={height}
                insets={insets}
              />
            )}
          />
        ) : null}

        {/* ── Top bar ── */}
        {chrome ? (
          <LinearGradient colors={['rgba(0,0,0,0.7)', 'transparent']} style={[styles.top, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
            <TouchableOpacity onPress={close} style={styles.iconBtn} hitSlop={8} accessibilityLabel="Back">
              <ChevronLeft size={28} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.topCenter} pointerEvents="none">
              <Text style={styles.topTitle}>{title}</Text>
              {posts.length > 1 ? <Text style={styles.topSub}>{index + 1} of {posts.length}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => setMenuOpen(true)} style={styles.iconBtn} hitSlop={8} accessibilityLabel="Post options">
              <MoreHorizontal size={24} color="#FFF" />
            </TouchableOpacity>
          </LinearGradient>
        ) : null}

        {/* ── Options sheet ── */}
        {menuOpen && current ? (
          <Pressable style={styles.sheetBackdrop} onPress={() => setMenuOpen(false)}>
            <Pressable style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 12 }]} onPress={() => {}}>
              <View style={[styles.grab, { backgroundColor: colors.border }]} />
              {isMine ? (
                <>
                  <SheetItem icon={<Edit3 size={20} color={colors.text} />} label="Edit caption" color={colors.text}
                    onPress={() => { setMenuOpen(false); setEditText(current.caption); setEditing(true); }} />
                  <SheetItem icon={<Trash2 size={20} color={colors.live} />} label="Delete" color={colors.live} onPress={handleDelete} />
                </>
              ) : (
                <>
                  <SheetItem icon={<User size={20} color={colors.text} />} label={`View ${current.author.username ? '@' + current.author.username : 'profile'}`} color={colors.text}
                    onPress={() => goProfile(current.author.id)} />
                  <SheetItem icon={<Repeat size={20} color={colors.text} />} label="Reshare to your feed" color={colors.text} onPress={reshare} />
                  <SheetItem icon={<Flag size={20} color={colors.live} />} label="Report" color={colors.live} onPress={report} />
                </>
              )}
              <TouchableOpacity style={[styles.cancel, { borderTopColor: colors.border }]} onPress={() => setMenuOpen(false)}>
                <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        ) : null}

        {/* ── Edit caption ── */}
        {editing && current ? (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditing(false)} />
            <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 12 }]}>
              <View style={styles.editHeader}>
                <TouchableOpacity onPress={() => setEditing(false)} hitSlop={8}><X size={22} color={colors.text} /></TouchableOpacity>
                <Text style={[styles.editTitle, { color: colors.text }]}>Edit caption</Text>
                <TouchableOpacity onPress={saveEdit} disabled={savingEdit} hitSlop={8}>
                  <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 16, opacity: savingEdit ? 0.5 : 1 }}>{savingEdit ? 'Saving…' : 'Done'}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.editBody}>
                {current.imageUrl ? <Image source={{ uri: current.imageUrl }} style={styles.editThumb} /> : null}
                <TextInput
                  style={[styles.editInput, { color: colors.text, borderColor: colors.border }]}
                  value={editText}
                  onChangeText={setEditText}
                  placeholder="Write a caption…"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  autoFocus
                  maxLength={2200}
                />
              </View>
              <Text style={[styles.editCount, { color: colors.textTertiary }]}>{editText.length}/2200</Text>
            </View>
          </KeyboardAvoidingView>
        ) : null}
      </View>

      {commentsFor ? (
        <CommentsSheet
          visible={!!commentsFor}
          postId={commentsFor.id}
          postOwnerId={commentsFor.userId}
          colors={colors}
          onClose={() => setCommentsFor(null)}
          onOpenProfile={(id) => { if (id) goProfile(id); }}
          onCountChange={(n) => {
            const id = commentsFor.id;
            setPosts((prev) => prev.map((p) => (p.id === id && p.commentCount !== n ? { ...p, commentCount: n } : p)));
          }}
        />
      ) : null}
    </Modal>
  );
}

function SheetItem({ icon, label, color, onPress }: { icon: React.ReactNode; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.sheetItem} onPress={onPress}>
      {icon}
      <Text style={[styles.sheetText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  textCard: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  textCardBody: { color: '#FFF', fontSize: 26, lineHeight: 34, fontWeight: '800', textAlign: 'center' },

  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 24 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topCenter: { flex: 1, alignItems: 'center' },
  topTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  topSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 1 },

  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 60 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  authorName: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  authorMeta: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 1 },
  caption: { color: '#FFF', fontSize: 14, lineHeight: 20 },
  more: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600', marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 14 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  actionText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  viewComments: { color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 10 },

  sheetBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 8 },
  grab: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingVertical: 15 },
  sheetText: { fontSize: 16, fontWeight: '500' },
  cancel: { alignItems: 'center', paddingVertical: 15, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4 },

  editHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 10 },
  editTitle: { fontSize: 16, fontWeight: '700' },
  editBody: { flexDirection: 'row', gap: 12, paddingHorizontal: 18, paddingTop: 6 },
  editThumb: { width: 56, height: 56, borderRadius: 6 },
  editInput: { flex: 1, minHeight: 90, maxHeight: 200, fontSize: 15, textAlignVertical: 'top', borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10 },
  editCount: { fontSize: 11, textAlign: 'right', paddingHorizontal: 18, paddingTop: 6 },
});
