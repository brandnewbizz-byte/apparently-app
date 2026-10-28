import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSocial } from '@/contexts/SocialContext';
import { logger } from '@/lib/logger';

export type CommentStatus = 'sent' | 'pending' | 'failed';

export interface CommentNode {
  id: string;
  postId: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
  text: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  status: CommentStatus;
  replies: CommentNode[];
}

interface Options {
  /** Only fetch/subscribe while the UI is on screen. */
  enabled?: boolean;
  /** Owner of the post — they can remove any comment and get an "Author" badge. */
  postOwnerId?: string | null;
}

/**
 * Single source of truth for a post's comments: loads from post_comments (with
 * author profiles), persisted likes from comment_likes, keeps itself live via
 * realtime, and exposes optimistic send / retry / delete / like.
 */
export function useComments(postId: string | undefined, { enabled = true, postOwnerId }: Options = {}) {
  const { user } = useAuth();
  const { addComment, adjustCommentCount } = useSocial();
  const myId = user?.id || '';

  const [rows, setRows] = useState<CommentNode[]>([]); // flat list, server + optimistic
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const pendingText = useRef<Record<string, { text: string; parentId: string | null; replyToAuthorId?: string }>>({});
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!postId) return;
    try {
      const { data, error: err } = await supabase
        .from('post_comments')
        .select('id, post_id, author_id, text, parent_id, created_at, author:profiles!post_comments_author_id_fkey(id, full_name, username, avatar)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
        .limit(500);
      if (err) throw err;
      const list = (data || []) as any[];
      const ids = list.map((c) => c.id);
      let likes: { comment_id: string; user_id: string }[] = [];
      if (ids.length) {
        const { data: likeRows } = await supabase.from('comment_likes').select('comment_id, user_id').in('comment_id', ids);
        likes = (likeRows || []) as any[];
      }
      const likeCount = new Map<string, number>();
      const mine = new Set<string>();
      for (const l of likes) {
        likeCount.set(l.comment_id, (likeCount.get(l.comment_id) || 0) + 1);
        if (l.user_id === myId) mine.add(l.comment_id);
      }
      const server: CommentNode[] = list.map((c) => {
        const a = Array.isArray(c.author) ? c.author[0] : c.author;
        return {
          id: String(c.id),
          postId: c.post_id,
          parentId: c.parent_id || null,
          authorId: c.author_id,
          authorName: a?.full_name || a?.username || 'User',
          authorUsername: a?.username || '',
          authorAvatar: a?.avatar || '',
          text: c.text || '',
          createdAt: c.created_at || '',
          likeCount: likeCount.get(c.id) || 0,
          likedByMe: mine.has(c.id),
          status: 'sent',
          replies: [],
        };
      });
      // Keep optimistic rows that the server hasn't returned yet (or that failed).
      setRows((prev) => [...server, ...prev.filter((r) => r.status !== 'sent')]);
      setError(false);
    } catch (e: any) {
      logger.warn('useComments', 'load failed', { error: e?.message, postId });
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [postId, myId]);

  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => { load(); }, 250);
  }, [load]);

  useEffect(() => {
    if (!enabled || !postId) return;
    setLoading(true);
    setRows([]);
    load();
    const channel = supabase
      .channel(`comments-${postId}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments', filter: `post_id=eq.${postId}` }, scheduleReload)
      .subscribe();
    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      supabase.removeChannel(channel);
    };
  }, [enabled, postId, load, scheduleReload]);

  /** Threaded view: top-level comments (oldest first) with replies nested one level. */
  const threads = useMemo(() => {
    const byId = new Map<string, CommentNode>();
    const top: CommentNode[] = [];
    for (const r of rows) byId.set(r.id, { ...r, replies: [] });
    for (const r of byId.values()) {
      const parent = r.parentId ? byId.get(r.parentId) : undefined;
      if (parent) parent.replies.push(r);
      else top.push(r);
    }
    return top;
  }, [rows]);

  const total = rows.length;

  const send = useCallback(async (rawText: string, replyTo?: CommentNode | null) => {
    const text = rawText.trim();
    if (!text || !postId || !myId) return false;
    // Replies stay one level deep: replying to a reply attaches to its root.
    const parentId = replyTo ? (replyTo.parentId || replyTo.id) : null;
    const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const temp: CommentNode = {
      id: tempId, postId, parentId,
      authorId: myId,
      authorName: user?.fullName || user?.username || 'You',
      authorUsername: user?.username || '',
      authorAvatar: user?.avatar || '',
      text, createdAt: new Date().toISOString(),
      likeCount: 0, likedByMe: false, status: 'pending', replies: [],
    };
    pendingText.current[tempId] = { text, parentId, replyToAuthorId: replyTo?.authorId };
    setRows((prev) => [...prev, temp]);
    const ok = await addComment(postId, text, parentId || undefined, { queueOnFail: false, replyToAuthorId: replyTo?.authorId });
    if (ok) {
      delete pendingText.current[tempId];
      setRows((prev) => prev.filter((r) => r.id !== tempId));
      await load();
    } else {
      setRows((prev) => prev.map((r) => (r.id === tempId ? { ...r, status: 'failed' } : r)));
    }
    return ok;
  }, [postId, myId, user, addComment, load]);

  const retry = useCallback(async (id: string) => {
    const p = pendingText.current[id];
    if (!p || !postId) return;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'pending' } : r)));
    const ok = await addComment(postId, p.text, p.parentId || undefined, { queueOnFail: false, replyToAuthorId: p.replyToAuthorId });
    if (ok) {
      delete pendingText.current[id];
      setRows((prev) => prev.filter((r) => r.id !== id));
      await load();
    } else {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'failed' } : r)));
    }
  }, [postId, addComment, load]);

  const canDelete = useCallback((c: CommentNode) => !!myId && (c.authorId === myId || (!!postOwnerId && postOwnerId === myId)), [myId, postOwnerId]);

  const remove = useCallback(async (c: CommentNode) => {
    if (c.status !== 'sent') {
      delete pendingText.current[c.id];
      setRows((prev) => prev.filter((r) => r.id !== c.id));
      return true;
    }
    const removedIds = new Set([c.id, ...rows.filter((r) => r.parentId === c.id).map((r) => r.id)]);
    const snapshot = rows;
    setRows((prev) => prev.filter((r) => !removedIds.has(r.id)));
    const { error: err } = await supabase.from('post_comments').delete().eq('id', c.id);
    if (err) {
      setRows(snapshot);
      return false;
    }
    if (postId) adjustCommentCount(postId, -removedIds.size);
    return true;
  }, [rows, postId, adjustCommentCount]);

  const toggleLike = useCallback(async (c: CommentNode) => {
    if (!myId || c.status !== 'sent') return;
    const nextLiked = !c.likedByMe;
    const flip = (liked: boolean) => setRows((prev) => prev.map((r) => (r.id === c.id
      ? { ...r, likedByMe: liked, likeCount: Math.max(0, r.likeCount + (liked ? 1 : -1)) }
      : r)));
    flip(nextLiked);
    const { error: err } = nextLiked
      ? await supabase.from('comment_likes').upsert({ comment_id: c.id, user_id: myId }, { onConflict: 'comment_id,user_id', ignoreDuplicates: true })
      : await supabase.from('comment_likes').delete().eq('comment_id', c.id).eq('user_id', myId);
    if (err) {
      logger.warn('useComments', 'comment like failed', { error: err.message });
      flip(!nextLiked);
    }
  }, [myId]);

  const report = useCallback(async (c: CommentNode) => {
    const { error: err } = await supabase.from('reports').insert({ post_id: c.postId, reported_by: myId || null, reason: `comment:${c.id}` });
    return !err;
  }, [myId]);

  return { threads, total, loading, error, refresh: load, send, retry, remove, toggleLike, canDelete, report, myId };
}

/** Compact relative time: "now", "5m", "3h", "2d", "4w", then a date. */
export function shortTimeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!iso || isNaN(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
