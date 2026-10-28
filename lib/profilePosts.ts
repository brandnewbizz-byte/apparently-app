import { supabase } from '@/lib/supabase';
import { safeImageUrl, safeVideoUrl, isVideoUrl } from '@/lib/media';

export interface ProfilePost {
  id: string;
  userId: string;
  caption: string;
  /** Still image to show (photo, or a video's thumbnail when one exists). */
  imageUrl: string | null;
  videoUrl: string | null;
  isVideo: boolean;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  author: { id: string; name: string; username: string; avatar: string };
}

const POST_COLS = 'id, user_id, content, image_url, video_url, media_type, created_at, post_kind';

function normalize(p: any, author: any, likes: Map<string, number>, comments: Map<string, number>): ProfilePost {
  const rawImage = p.image_url as string | null;
  const videoUrl = safeVideoUrl(p.video_url) || (isVideoUrl(rawImage) ? safeVideoUrl(rawImage) : null);
  const isVideo = p.media_type === 'video' || !!videoUrl;
  const imageUrl = rawImage && !isVideoUrl(rawImage) ? safeImageUrl(rawImage) : null;
  return {
    id: p.id,
    userId: p.user_id,
    caption: (p.content || '').trim(),
    imageUrl,
    videoUrl,
    isVideo,
    createdAt: p.created_at,
    likeCount: likes.get(p.id) || 0,
    commentCount: comments.get(p.id) || 0,
    author: {
      id: p.user_id,
      name: author?.full_name || author?.username || 'User',
      username: author?.username || '',
      avatar: author?.avatar || '',
    },
  };
}

/** Real like/comment counts (the posts.likes/comments columns aren't maintained). */
async function countsFor(ids: string[]) {
  const likes = new Map<string, number>();
  const comments = new Map<string, number>();
  if (!ids.length) return { likes, comments };
  const [{ data: l }, { data: c }] = await Promise.all([
    supabase.from('post_likes').select('post_id').in('post_id', ids),
    supabase.from('post_comments').select('post_id').in('post_id', ids),
  ]);
  for (const r of (l || []) as any[]) likes.set(r.post_id, (likes.get(r.post_id) || 0) + 1);
  for (const r of (c || []) as any[]) comments.set(r.post_id, (comments.get(r.post_id) || 0) + 1);
  return { likes, comments };
}

async function authorsFor(userIds: string[]) {
  const map = new Map<string, any>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return map;
  const { data } = await supabase.from('profiles').select('id, full_name, username, avatar').in('id', ids);
  for (const p of (data || []) as any[]) map.set(p.id, p);
  return map;
}

const isRenderable = (p: ProfilePost) => !!(p.caption || p.imageUrl || p.videoUrl);

/** A user's own posts (reshares excluded), newest first. */
export async function fetchUserPosts(userId: string, limit = 120): Promise<ProfilePost[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_COLS)
    .eq('user_id', userId)
    .or('post_kind.is.null,post_kind.neq.reshare')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data || []) as any[];
  const [{ likes, comments }, authors] = await Promise.all([countsFor(rows.map((r) => r.id)), authorsFor([userId])]);
  return rows.map((r) => normalize(r, authors.get(r.user_id), likes, comments)).filter(isRenderable);
}

/** Posts the user bookmarked (saved_posts), most recently saved first. */
export async function fetchSavedPosts(userId: string): Promise<ProfilePost[]> {
  const { data: saved, error } = await supabase
    .from('saved_posts')
    .select('post_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  const order = ((saved || []) as any[]).map((s) => String(s.post_id));
  if (!order.length) return [];
  const { data: posts } = await supabase.from('posts').select(POST_COLS).in('id', order);
  const rows = (posts || []) as any[];
  const [{ likes, comments }, authors] = await Promise.all([
    countsFor(rows.map((r) => r.id)),
    authorsFor(rows.map((r) => r.user_id)),
  ]);
  const byId = new Map(rows.map((r) => [r.id, normalize(r, authors.get(r.user_id), likes, comments)]));
  return order.map((id) => byId.get(id)).filter((p): p is ProfilePost => !!p && isRenderable(p));
}

export async function setSaved(userId: string, postId: string, save: boolean) {
  const { error } = save
    ? await supabase.from('saved_posts').upsert({ user_id: userId, post_id: postId }, { onConflict: 'user_id,post_id' })
    : await supabase.from('saved_posts').delete().eq('user_id', userId).eq('post_id', postId);
  return !error;
}
