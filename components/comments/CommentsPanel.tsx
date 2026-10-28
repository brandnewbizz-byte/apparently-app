import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { TextInputInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Heart, MessageCircle, RotateCcw, X, CornerDownRight, Trash2, Flag, Reply } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useComments, shortTimeAgo, type CommentNode } from './useComments';

const QUICK_EMOJI = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'];
const REPLIES_PREVIEW = 2;
const MAX_LEN = 1000;

const tap = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

// ─────────────────────────────────────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────────────────────────────────────
export function CommentAvatar({ uri, name, size, colors }: { uri?: string; name?: string; size: number; colors: any }) {
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceHighlight }} />;
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accent + '26', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.accent, fontWeight: '700', fontSize: size * 0.42 }}>{initial}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rich text: highlights @mentions (tappable) and #tags
// ─────────────────────────────────────────────────────────────────────────────
function RichText({ text, colors, onMention }: { text: string; colors: any; onMention: (u: string) => void }) {
  const parts = text.split(/(@[A-Za-z0-9_.]+|#[A-Za-z0-9_]+)/g);
  return (
    <Text style={[s.body, { color: colors.text }]}>
      {parts.map((p, i) => {
        if (p.startsWith('@') && p.length > 1) {
          return <Text key={i} style={{ color: colors.accent, fontWeight: '600' }} onPress={() => onMention(p.slice(1))}>{p}</Text>;
        }
        if (p.startsWith('#') && p.length > 1) return <Text key={i} style={{ color: colors.accent }}>{p}</Text>;
        return <Text key={i}>{p}</Text>;
      })}
    </Text>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// One comment row
// ─────────────────────────────────────────────────────────────────────────────
function CommentRow({
  c, isReply, isPostAuthor, colors, onReply, onLike, onMore, onRetry, onOpenProfile, onMention,
}: {
  c: CommentNode; isReply?: boolean; isPostAuthor: boolean; colors: any;
  onReply: (c: CommentNode) => void; onLike: (c: CommentNode) => void; onMore: (c: CommentNode) => void;
  onRetry: (c: CommentNode) => void; onOpenProfile: (id?: string) => void; onMention: (u: string) => void;
}) {
  const lastTap = useRef(0);
  const handlePress = () => {
    const now = Date.now();
    if (now - lastTap.current < 280 && !c.likedByMe) { onLike(c); }
    lastTap.current = now;
  };
  const size = isReply ? 26 : 34;
  return (
    <Pressable
      onPress={handlePress}
      onLongPress={() => { tap(); onMore(c); }}
      delayLongPress={320}
      style={({ pressed }) => [s.row, isReply && s.replyRow, { opacity: c.status === 'pending' ? 0.55 : 1 }, pressed && { backgroundColor: colors.surfaceHighlight + '80' }]}
    >
      <TouchableOpacity onPress={() => onOpenProfile(c.authorId)} hitSlop={6} accessibilityLabel={`Open ${c.authorName}'s profile`}>
        <CommentAvatar uri={c.authorAvatar} name={c.authorName} size={size} colors={colors} />
      </TouchableOpacity>

      <View style={s.rowMain}>
        <View style={s.metaLine}>
          <Text style={[s.name, { color: colors.text }]} numberOfLines={1} onPress={() => onOpenProfile(c.authorId)}>
            {c.authorUsername || c.authorName}
          </Text>
          {isPostAuthor ? (
            <View style={[s.badge, { backgroundColor: colors.accent + '1F' }]}><Text style={[s.badgeText, { color: colors.accent }]}>Author</Text></View>
          ) : null}
          <Text style={[s.time, { color: colors.textTertiary }]}>{c.status === 'pending' ? 'Posting…' : shortTimeAgo(c.createdAt)}</Text>
        </View>

        <RichText text={c.text} colors={colors} onMention={onMention} />

        {c.status === 'failed' ? (
          <TouchableOpacity style={s.failedRow} onPress={() => onRetry(c)} accessibilityLabel="Retry posting comment">
            <RotateCcw size={13} color={colors.live} />
            <Text style={[s.failedText, { color: colors.live }]}>Couldn{'\u2019'}t post. Tap to retry</Text>
          </TouchableOpacity>
        ) : c.status === 'sent' ? (
          <View style={s.actions}>
            {c.likeCount > 0 ? <Text style={[s.actionText, { color: colors.textTertiary }]}>{c.likeCount} {c.likeCount === 1 ? 'like' : 'likes'}</Text> : null}
            <TouchableOpacity onPress={() => onReply(c)} hitSlop={8}>
              <Text style={[s.actionText, s.actionStrong, { color: colors.textTertiary }]}>Reply</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {c.status === 'sent' ? (
        <TouchableOpacity style={s.likeBtn} onPress={() => { tap(); onLike(c); }} hitSlop={10} accessibilityLabel={c.likedByMe ? 'Unlike comment' : 'Like comment'}>
          <Heart size={isReply ? 13 : 15} color={c.likedByMe ? colors.live : colors.textTertiary} fill={c.likedByMe ? colors.live : 'none'} />
        </TouchableOpacity>
      ) : <View style={s.likeBtn} />}
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Thread = top-level comment + its replies (collapsible)
// ─────────────────────────────────────────────────────────────────────────────
function Thread(props: React.ComponentProps<typeof CommentRow> & { postOwnerId?: string | null }) {
  const { c, colors, postOwnerId } = props;
  const [expanded, setExpanded] = useState(false);
  const replies = c.replies;
  const hidden = Math.max(0, replies.length - REPLIES_PREVIEW);
  // Always show your own fresh replies so a sent reply never "disappears".
  const visible = expanded || hidden === 0 ? replies : replies.slice(-REPLIES_PREVIEW);
  return (
    <View>
      <CommentRow {...props} />
      {hidden > 0 && !expanded ? (
        <TouchableOpacity style={s.moreReplies} onPress={() => setExpanded(true)}>
          <View style={[s.moreLine, { backgroundColor: colors.border }]} />
          <Text style={[s.moreText, { color: colors.textTertiary }]}>View {hidden} more {hidden === 1 ? 'reply' : 'replies'}</Text>
        </TouchableOpacity>
      ) : null}
      {visible.map((r) => (
        <CommentRow key={r.id} {...props} c={r} isReply isPostAuthor={!!postOwnerId && r.authorId === postOwnerId} />
      ))}
      {expanded && hidden > 0 ? (
        <TouchableOpacity style={s.moreReplies} onPress={() => setExpanded(false)}>
          <View style={[s.moreLine, { backgroundColor: colors.border }]} />
          <Text style={[s.moreText, { color: colors.textTertiary }]}>Hide replies</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composer
// ─────────────────────────────────────────────────────────────────────────────
interface MentionUser { id: string; username: string; full_name: string | null; avatar: string | null }

function Composer({
  colors, replyTo, onCancelReply, onSend, inputRef, autoFocus, bottomInset,
}: {
  colors: any; replyTo: CommentNode | null; onCancelReply: () => void;
  onSend: (text: string) => void; inputRef: React.RefObject<TextInputInstance | null>; autoFocus?: boolean; bottomInset: number;
}) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [mentions, setMentions] = useState<MentionUser[]>([]);
  const mentionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-fill "@username " when starting a reply
  useEffect(() => {
    if (replyTo) {
      const handle = replyTo.authorUsername || replyTo.authorName.replace(/\s/g, '');
      if (replyTo.authorId !== user?.id) setText((t) => (t.startsWith(`@${handle}`) ? t : `@${handle} `));
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [replyTo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onChange = (t: string) => {
    setText(t);
    const m = t.match(/@([A-Za-z0-9_.]{1,30})$/);
    if (mentionTimer.current) clearTimeout(mentionTimer.current);
    if (!m) { setMentions([]); return; }
    mentionTimer.current = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('id, username, full_name, avatar').ilike('username', `${m[1]}%`).limit(6);
      setMentions(((data || []) as MentionUser[]).filter((u) => !!u.username));
    }, 180);
  };

  const pickMention = (u: MentionUser) => {
    setText((t) => t.replace(/@([A-Za-z0-9_.]*)$/, `@${u.username} `));
    setMentions([]);
    inputRef.current?.focus();
  };

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    tap();
    onSend(t);
    setText('');
    setMentions([]);
  };

  const canSend = text.trim().length > 0;
  const myName = user?.fullName || user?.username || 'You';

  return (
    <View style={[s.composerWrap, { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: Math.max(bottomInset, 10) }]}>
      {mentions.length > 0 ? (
        <View style={[s.mentionList, { borderBottomColor: colors.border }]}>
          {mentions.map((u) => (
            <TouchableOpacity key={u.id} style={s.mentionItem} onPress={() => pickMention(u)}>
              <CommentAvatar uri={u.avatar || undefined} name={u.full_name || u.username} size={30} colors={colors} />
              <View style={{ flex: 1 }}>
                <Text style={[s.mentionUser, { color: colors.text }]}>{u.username}</Text>
                {u.full_name ? <Text style={[s.mentionName, { color: colors.textTertiary }]} numberOfLines={1}>{u.full_name}</Text> : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {replyTo ? (
        <View style={[s.replyBanner, { backgroundColor: colors.backgroundTertiary }]}>
          <CornerDownRight size={14} color={colors.textTertiary} />
          <Text style={[s.replyBannerText, { color: colors.textSecondary }]} numberOfLines={1}>
            Replying to <Text style={{ fontWeight: '700', color: colors.text }}>{replyTo.authorUsername || replyTo.authorName}</Text>
          </Text>
          <TouchableOpacity onPress={() => { onCancelReply(); setText(''); }} hitSlop={10} accessibilityLabel="Cancel reply">
            <X size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.emojiRow}>
          {QUICK_EMOJI.map((e) => (
            <TouchableOpacity key={e} onPress={() => { setText((t) => t + e); inputRef.current?.focus(); }} hitSlop={4} accessibilityLabel={`Add ${e}`}>
              <Text style={s.emoji}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={s.inputRow}>
        <CommentAvatar uri={user?.avatar} name={myName} size={34} colors={colors} />
        <View style={[s.inputPill, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <TextInput
            ref={inputRef}
            style={[s.input, { color: colors.text }]}
            placeholder={replyTo ? `Reply to ${replyTo.authorUsername || replyTo.authorName}…` : `Add a comment for ${myName.split(' ')[0]}…`}
            placeholderTextColor={colors.textTertiary}
            value={text}
            onChangeText={onChange}
            multiline
            maxLength={MAX_LEN}
            autoFocus={autoFocus}
            accessibilityLabel="Comment text"
          />
          {canSend ? (
            <TouchableOpacity onPress={submit} style={[s.sendBtn, { backgroundColor: colors.accent }]} accessibilityLabel="Post comment">
              <Text style={s.sendText}>Post</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {text.length > MAX_LEN - 100 ? (
        <Text style={[s.counter, { color: text.length >= MAX_LEN ? colors.live : colors.textTertiary }]}>{text.length}/{MAX_LEN}</Text>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Long-press action sheet (rendered inside the panel so it works inside any Modal)
// ─────────────────────────────────────────────────────────────────────────────
function ActionSheet({ c, colors, canDelete, onClose, onReply, onDelete, onReport }: {
  c: CommentNode; colors: any; canDelete: boolean; onClose: () => void;
  onReply: () => void; onDelete: () => void; onReport: () => void;
}) {
  const { user } = useAuth();
  const isMine = c.authorId === user?.id;
  return (
    <Pressable style={s.sheetBackdrop} onPress={onClose}>
      <Pressable style={[s.sheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
        <View style={[s.sheetGrab, { backgroundColor: colors.border }]} />
        <Text style={[s.sheetPreview, { color: colors.textSecondary }]} numberOfLines={2}>
          <Text style={{ fontWeight: '700', color: colors.text }}>{c.authorUsername || c.authorName}</Text>  {c.text}
        </Text>
        {c.status === 'sent' ? (
          <TouchableOpacity style={s.sheetItem} onPress={onReply}>
            <Reply size={20} color={colors.text} /><Text style={[s.sheetText, { color: colors.text }]}>Reply</Text>
          </TouchableOpacity>
        ) : null}
        {canDelete ? (
          <TouchableOpacity style={s.sheetItem} onPress={onDelete}>
            <Trash2 size={20} color={colors.live} /><Text style={[s.sheetText, { color: colors.live }]}>Delete</Text>
          </TouchableOpacity>
        ) : null}
        {!isMine && c.status === 'sent' ? (
          <TouchableOpacity style={s.sheetItem} onPress={onReport}>
            <Flag size={20} color={colors.live} /><Text style={[s.sheetText, { color: colors.live }]}>Report</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[s.sheetItem, s.sheetCancel, { borderTopColor: colors.border }]} onPress={onClose}>
          <Text style={[s.sheetText, { color: colors.textSecondary, textAlign: 'center', flex: 1 }]}>Cancel</Text>
        </TouchableOpacity>
      </Pressable>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public panel: list + composer. Pass `header` to render content (e.g. the post) above the comments.
// ─────────────────────────────────────────────────────────────────────────────
export interface CommentsPanelProps {
  postId: string;
  postOwnerId?: string | null;
  colors: any;
  enabled?: boolean;
  header?: React.ReactElement | null;
  /** Show the "N comments" label above the list (sheet header shows it otherwise). */
  showCountLabel?: boolean;
  autoFocus?: boolean;
  onOpenProfile: (userId?: string) => void;
  onCountChange?: (n: number) => void;
}

export default function CommentsPanel({
  postId, postOwnerId, colors, enabled = true, header, showCountLabel, autoFocus, onOpenProfile, onCountChange,
}: CommentsPanelProps) {
  const insets = useSafeAreaInsets();
  const { threads, total, loading, error, refresh, send, retry, remove, toggleLike, canDelete, report } =
    useComments(postId, { enabled, postOwnerId });
  const [replyTo, setReplyTo] = useState<CommentNode | null>(null);
  const [menuFor, setMenuFor] = useState<CommentNode | null>(null);
  const inputRef = useRef<TextInputInstance>(null);
  const listRef = useRef<FlatList<CommentNode>>(null);

  useEffect(() => { if (!loading) onCountChange?.(total); }, [total, loading, onCountChange]);

  const handleSend = useCallback(async (text: string) => {
    const target = replyTo;
    setReplyTo(null);
    if (!target) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
    const ok = await send(text, target);
    if (!ok && Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, [replyTo, send]);

  const openMention = useCallback(async (username: string) => {
    const { data } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
    if (data?.id) onOpenProfile(data.id);
  }, [onOpenProfile]);

  const confirmDelete = (c: CommentNode) => {
    setMenuFor(null);
    Alert.alert('Delete comment?', c.replies.length ? 'Replies to this comment will be removed too.' : undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const ok = await remove(c);
          if (!ok) Alert.alert('Could not delete', 'Check your connection and try again.');
        },
      },
    ]);
  };

  const rowProps = {
    colors,
    postOwnerId,
    onReply: (c: CommentNode) => setReplyTo(c),
    onLike: toggleLike,
    onMore: (c: CommentNode) => setMenuFor(c),
    onRetry: (c: CommentNode) => retry(c.id),
    onOpenProfile,
    onMention: openMention,
  };

  const listHeader = (
    <View>
      {header}
      {showCountLabel ? (
        <Text style={[s.countLabel, { color: colors.text }]}>
          {loading ? 'Comments' : total === 0 ? 'Comments' : `${total} ${total === 1 ? 'comment' : 'comments'}`}
        </Text>
      ) : null}
    </View>
  );

  const empty = loading ? (
    <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={s.skelRow}>
          <View style={[s.skelAvatar, { backgroundColor: colors.surfaceHighlight }]} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={[s.skelLine, { width: '35%', backgroundColor: colors.surfaceHighlight }]} />
            <View style={[s.skelLine, { width: i === 1 ? '60%' : '85%', backgroundColor: colors.surfaceHighlight }]} />
          </View>
        </View>
      ))}
    </View>
  ) : error ? (
    <View style={s.empty}>
      <Text style={[s.emptyTitle, { color: colors.text }]}>Couldn{'\u2019'}t load comments</Text>
      <TouchableOpacity onPress={refresh} style={[s.retryBtn, { borderColor: colors.border }]}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>Try again</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <View style={s.empty}>
      <View style={[s.emptyIcon, { borderColor: colors.border }]}>
        <MessageCircle size={26} color={colors.textTertiary} />
      </View>
      <Text style={[s.emptyTitle, { color: colors.text }]}>No comments yet</Text>
      <Text style={[s.emptySub, { color: colors.textTertiary }]}>Start the conversation.</Text>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={listRef}
        data={threads}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <Thread {...rowProps} c={item} isPostAuthor={!!postOwnerId && item.authorId === postOwnerId} />
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={empty}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
      />
      <Composer
        colors={colors}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSend={handleSend}
        inputRef={inputRef}
        autoFocus={autoFocus}
        bottomInset={insets.bottom}
      />
      {menuFor ? (
        <ActionSheet
          c={menuFor}
          colors={colors}
          canDelete={canDelete(menuFor)}
          onClose={() => setMenuFor(null)}
          onReply={() => { setReplyTo(menuFor); setMenuFor(null); }}
          onDelete={() => confirmDelete(menuFor)}
          onReport={async () => {
            const c = menuFor;
            setMenuFor(null);
            const ok = await report(c);
            Alert.alert(ok ? 'Thanks for letting us know' : 'Could not report', ok ? 'We’ll review this comment.' : 'Please try again.');
          }}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  replyRow: { paddingLeft: 62, paddingVertical: 7, gap: 10 },
  rowMain: { flex: 1, minWidth: 0 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  name: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
  time: { fontSize: 12 },
  body: { fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 6 },
  actionText: { fontSize: 12 },
  actionStrong: { fontWeight: '700' },
  failedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  failedText: { fontSize: 12, fontWeight: '600' },
  likeBtn: { width: 22, alignItems: 'center', paddingTop: 16 },
  moreReplies: { flexDirection: 'row', alignItems: 'center', paddingLeft: 62, paddingVertical: 6, gap: 10 },
  moreLine: { width: 24, height: StyleSheet.hairlineWidth * 2 },
  moreText: { fontSize: 12, fontWeight: '700' },
  countLabel: { fontSize: 15, fontWeight: '700', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },

  composerWrap: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  emoji: { fontSize: 24 },
  replyBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  replyBannerText: { flex: 1, fontSize: 13 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 12 },
  inputPill: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: 22, paddingLeft: 14, paddingRight: 5, minHeight: 40 },
  input: { flex: 1, fontSize: 14, maxHeight: 110, paddingTop: Platform.OS === 'ios' ? 11 : 8, paddingBottom: Platform.OS === 'ios' ? 11 : 8 },
  sendBtn: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 4, marginLeft: 6 },
  sendText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  counter: { fontSize: 11, textAlign: 'right', paddingHorizontal: 18, paddingTop: 4 },
  mentionList: { borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  mentionItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 7 },
  mentionUser: { fontSize: 14, fontWeight: '600' },
  mentionName: { fontSize: 12 },

  empty: { alignItems: 'center', paddingTop: 48, paddingBottom: 32, paddingHorizontal: 32 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 14, marginTop: 4 },
  retryBtn: { marginTop: 12, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 18, borderWidth: 1 },
  skelRow: { flexDirection: 'row', gap: 12, paddingVertical: 10 },
  skelAvatar: { width: 34, height: 34, borderRadius: 17 },
  skelLine: { height: 10, borderRadius: 5 },

  sheetBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end', zIndex: 50, elevation: 50 },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 28, paddingTop: 8 },
  sheetGrab: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  sheetPreview: { fontSize: 13, paddingHorizontal: 20, paddingBottom: 10 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  sheetCancel: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4 },
  sheetText: { fontSize: 16, fontWeight: '500' },
});
