// ═══════════════════════════════════════════════════════════════════════════
// API Module — Supabase Live Backend
// All calls go directly to Supabase (live), not the local dev server.
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';

export const LOCAL_API = 'https://inejlmksbzujgpwvnnch.supabase.co';
const API_BASE = LOCAL_API;
export const DEFAULT_USER_ID = 'u-dev';

// ─── Posts ───
export async function getPosts() {
  // Fetch posts, then batch-fetch profiles for user data
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  if (!data || data.length === 0) return [];
  
  // Collect unique user IDs and fetch profiles in one query
  const userIds = [...new Set(data.map((p: any) => p.user_id).filter(Boolean))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar')
    .in('id', userIds);
  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
  
  // Merge profile data into each post
  return data.map((p: any) => {
    const profile = profileMap.get(p.user_id);
    return {
      ...p,
      user: profile ? {
        id: profile.id,
        name: profile.full_name,
        username: profile.username,
        avatar: profile.avatar,
      } : null,
    };
  });
}

export async function createPost(
  userId: string,
  content: string,
  imageUrl?: string,
  options?: { postKind?: 'post' | 'sell'; category?: string }
) {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      content,
      image_url: imageUrl || null,
      post_kind: options?.postKind || 'post',
      category: options?.category || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePost(postId: string) {
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId);
  if (error) throw error;
  return { ok: true };
}

// ─── Stories ───
export async function getStories() {
  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createStory(userId: string, imageUrl: string, backgroundColor?: string, textContent?: string) {
  const { data, error } = await supabase
    .from('stories')
    .insert({
      user_id: userId,
      image_url: imageUrl,
      background_color: backgroundColor || null,
      text_content: textContent || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Likes ───
export async function toggleLike(postId: string, userId: string) {
  // Check if already liked
  const { data: existing } = await supabase
    .from('post_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId )
    .maybeSingle();

  if (existing) {
    // Unlike
    const { error } = await supabase
      .from('post_likes')
      .delete()
      .eq('id', existing.id);
    if (error) throw error;
    return { liked: false };
  } else {
    // Like
    const { error } = await supabase
      .from('post_likes')
      .insert({
        post_id: postId,
        user_id: userId,
      });
    if (error) throw error;
    return { liked: true };
  }
}

export async function getLikeStatus(postId: string, userId?: string) {
  const uid = userId ;
  const { data, error } = await supabase
    .from('post_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', uid)
    .maybeSingle();
  if (error) throw error;
  return { liked: !!data };
}

// ─── Comments ───
export async function getComments(postId: string) {
  const { data, error } = await supabase
    .from('post_comments')
    .select('*')
    .eq('post_id', postId)
    .is('parent_id', null)
    .order('created_at', { ascending: true });
  if (error) throw error;

  // Fetch replies for each comment
  const comments = data || [];
  for (const comment of comments) {
    const { data: replies } = await supabase
      .from('post_comments')
      .select('*')
      .eq('parent_id', comment.id)
      .order('created_at', { ascending: true });
    (comment as any).replies = replies || [];
  }

  return comments;
}

export async function addComment(postId: string, authorId: string, text: string, parentId?: string) {
  const { data, error } = await supabase
    .from('post_comments')
    .insert({
      post_id: postId,
      author_id: authorId ,
      text,
      parent_id: parentId || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Users ───
export async function getUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getUser(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

// ─── Listings ───
export async function getListings(category?: string) {
  let query = supabase.from('listings').select('*').eq('status', 'available');
  if (category) {
    query = query.eq('category', category);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── Products ───
export async function getProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createProduct(product: {
  seller_id: string;
  seller_name: string;
  seller_avatar: string;
  seller_username: string;
  title: string;
  description: string;
  price: number;
  accepts_swap: boolean;
  condition: string;
  category: string;
  images: Array<{ id: string; uri: string }>;
  location: string;
}) {
  const { data, error } = await supabase
    .from('products')
    .insert({
      seller_id: product.seller_id,
      seller_name: product.seller_name,
      seller_avatar: product.seller_avatar,
      seller_username: product.seller_username,
      title: product.title,
      description: product.description,
      price: product.price,
      accepts_swap: product.accepts_swap,
      condition: product.condition,
      category: product.category,
      images: product.images,
      location: product.location,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Calendar Events ───
export async function getCalendarEvents(userId: string) {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', userId )
    .order('date', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createCalendarEvent(event: any) {
  const { data, error } = await supabase
    .from('calendar_events')
    .insert(event)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Bills ───
export async function getBills(userId: string) {
  const { data, error } = await supabase
    .from('bills')
    .select('*')
    .eq('user_id', userId )
    .order('due_date', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ─── Relationships ───
export async function getRelationships(userId: string) {
  const { data, error } = await supabase
    .from('relationships')
    .select('*')
    .eq('user_id', userId )
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── Swap ───
export async function getSwapPosts() {
  const { data, error } = await supabase
    .from('swap_posts')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createSwapPost(post: any) {
  const { data, error } = await supabase
    .from('swap_posts')
    .insert(post)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Bookings ───
export async function getBookings(userId?: string) {
  let query = supabase.from('bookings').select('*');
  if (userId) {
    query = query.eq('user_id', userId);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createBooking(booking: any) {
  const { data, error } = await supabase
    .from('bookings')
    .insert(booking)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Plans ───
export async function getPlans(userId: string) {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', userId )
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createPlan(plan: any) {
  const { data, error } = await supabase
    .from('plans')
    .insert(plan)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePlan(planId: string) {
  const { error } = await supabase
    .from('plans')
    .delete()
    .eq('id', planId);
  if (error) throw error;
  return { ok: true };
}

// ─── Swap Matches ───
export async function getSwapMatches(userId?: string) {
  let query = supabase.from('swap_matches').select('*');
  if (userId) {
    query = query.eq('user_id', userId);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createSwapMatch(match: any) {
  const { data, error } = await supabase
    .from('swap_matches')
    .insert(match)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSwapMatch(matchId: string, updates: any) {
  const { data, error } = await supabase
    .from('swap_matches')
    .update(updates)
    .eq('id', matchId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Connection Requests ───
export async function getConnectionRequests(userId?: string) {
  let query = supabase.from('connection_requests').select('*');
  if (userId) {
    query = query.eq('user_id', userId);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createConnectionRequest(req: any) {
  const { data, error } = await supabase
    .from('connection_requests')
    .insert(req)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Income Sources ───
export async function createIncomeSource(source: any) {
  const { data, error } = await supabase
    .from('income_sources')
    .insert(source)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Skill Deals ───
export async function getSkillDeals(creatorId?: string) {
  let query = supabase.from('skill_deals').select('*');
  if (creatorId) {
    query = query.eq('creator_id', creatorId);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createSkillDeal(deal: {
  creator_id: string; creator_name: string; creator_avatar: string;
  title: string; description: string; price: number; icon: string;
  image_url?: string; category?: string;
}) {
  const { data, error } = await supabase
    .from('skill_deals')
    .insert({
      creator_id: deal.creator_id,
      creator_name: deal.creator_name,
      creator_avatar: deal.creator_avatar,
      title: deal.title,
      description: deal.description,
      price: deal.price,
      icon: deal.icon,
      image_url: deal.image_url || null,
      category: deal.category || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function trackDealStat(type: 'skill' | 'bundle', id: string, field: 'grab' | 'skip' | 'view') {
  const table = type === 'skill' ? 'skill_deals' : 'bundles';
  const { data: existing } = await supabase
    .from(table)
    .select(field)
    .eq('id', id)
    .single();

  const current = (existing as any)?.[field] || 0;
  const { error } = await supabase
    .from(table)
    .update({ [field]: current + 1 })
    .eq('id', id);
  if (error) throw error;
  return { [field]: current + 1 };
}

export async function updateDeal(type: 'skill' | 'bundle', id: string, data: any) {
  const table = type === 'skill' ? 'skill_deals' : 'bundles';
  const { data: result, error } = await supabase
    .from(table)
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return result;
}

// ─── Bundles ───
export async function getBundles(creatorId?: string) {
  let query = supabase.from('bundles').select('*');
  if (creatorId) {
    query = query.eq('creator_id', creatorId);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createBundle(bundle: {
  creator_id: string; creator_name: string; creator_avatar: string;
  title: string; description: string; price: number;
  items: string[]; image_url?: string; category?: string;
}) {
  const { data, error } = await supabase
    .from('bundles')
    .insert({
      creator_id: bundle.creator_id,
      creator_name: bundle.creator_name,
      creator_avatar: bundle.creator_avatar,
      title: bundle.title,
      description: bundle.description,
      price: bundle.price,
      items: bundle.items,
      image_url: bundle.image_url || null,
      category: bundle.category || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Spot Feed (Live/Discovery) ───
export interface SpotCard {
  id: string;
  type: 'live' | 'featured' | 'upcoming' | 'past';
  title: string;
  streamerName: string;
  streamerAvatar: string;
  streamerId: string;
  thumbnail: string;
  viewers: number;
  category: string;
  tags: string[];
  isLive: boolean;
  scheduledFor?: string;
  duration?: string;
  description?: string;
  sourceType: 'post' | 'bundle' | 'user';
  sourceId: string;
  price?: number;
  likes?: number;
  commentsCount?: number;
  createdAt: string;
}

export interface SpotFeedResponse {
  cards: SpotCard[];
  summary: {
    total: number;
    liveCount: number;
    featuredCount: number;
    upcomingCount: number;
    pastCount: number;
  };
}

function spotDefaultAvatar(): string {
  return 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100';
}

function spotDefaultThumbnail(): string {
  return 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600';
}

function spotSafeImage(url: string | null | undefined): string {
  if (!url) return spotDefaultThumbnail();
  if (url.startsWith('file://')) return spotDefaultThumbnail();
  return url;
}

function spotTimeAgo(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHrs / 24);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

/**
 * Fetch the Spot (Live/Discovery) feed.
 * Aggregates posts, bundles into a unified card feed.
 */
export async function getSpotFeed(limit: number = 20): Promise<SpotFeedResponse> {
  const cards: SpotCard[] = [];

  // Fetch posts, then batch-fetch profiles for user info
  const { data: postsRaw, error: postsErr } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  let posts: any[] = [];
  if (!postsErr && postsRaw) {
    const userIds = [...new Set(postsRaw.map((p: any) => p.user_id).filter(Boolean))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar')
      .in('id', userIds);
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    posts = postsRaw.map((p: any) => {
      const profile = profileMap.get(p.user_id);
      return { ...p, user: profile || null };
    });
  } else if (postsErr) {
    console.error('[getSpotFeed] Error fetching posts:', postsErr.message);
  }

  // Fetch active bundles
  const { data: bundles, error: bundlesErr } = await supabase
    .from('bundles')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (bundlesErr) {
    console.error('[getSpotFeed] Error fetching bundles:', bundlesErr.message);
  }

  // ── Build feed ──

  // Featured: newest active bundle (or first post)
  const featuredBundle = bundles?.[0];
  const featuredPost = posts?.[0];

  if (featuredBundle) {
    cards.push({
      id: `featured-${featuredBundle.id}`,
      type: 'featured',
      title: featuredBundle.title,
      streamerName: featuredBundle.provider_name || 'Bundle Deal',
      streamerAvatar: featuredBundle.provider_avatar || spotDefaultAvatar(),
      streamerId: featuredBundle.user_id || '',
      thumbnail: spotSafeImage(featuredBundle.image),
      viewers: (featuredBundle.views || 0) + (featuredBundle.grabs || 0) * 10,
      category: featuredBundle.category || 'Lifestyle',
      tags: featuredBundle.items?.map((i: any) => i.title || '').filter(Boolean).slice(0, 3) || [featuredBundle.category || 'deal'],
      isLive: true,
      description: featuredBundle.description || undefined,
      sourceType: 'bundle',
      sourceId: featuredBundle.id,
      price: featuredBundle.bundle_price || featuredBundle.price || undefined,
      createdAt: featuredBundle.created_at,
    });
  } else if (featuredPost) {
    const user = (featuredPost as any).user;
    cards.push({
      id: `featured-${featuredPost.id}`,
      type: 'featured',
      title: featuredPost.content || 'New Post',
      streamerName: user?.name || user?.username || 'User',
      streamerAvatar: user?.avatar || spotDefaultAvatar(),
      streamerId: featuredPost.user_id,
      thumbnail: spotSafeImage(featuredPost.image_url),
      viewers: featuredPost.likes || 0,
      category: (featuredPost as any).post_kind === 'sell' ? 'Marketplace' : 'Creative',
      tags: (featuredPost as any).post_kind ? [(featuredPost as any).post_kind] : ['post'],
      isLive: true,
      description: featuredPost.content || undefined,
      sourceType: 'post',
      sourceId: featuredPost.id,
      likes: featuredPost.likes || 0,
      commentsCount: featuredPost.comments || 0,
      createdAt: featuredPost.created_at,
    });
  }

  // Live Now: recent posts (skip featured)
  const livePosts = featuredPost
    ? (posts || []).filter((p) => p.id !== featuredPost.id).slice(0, 6)
    : (posts || []).slice(1, 7);

  for (const post of livePosts) {
    const user = (post as any).user;
    cards.push({
      id: `live-${post.id}`,
      type: 'live',
      title: post.content || 'Photo Update',
      streamerName: user?.name || user?.username || 'User',
      streamerAvatar: user?.avatar || spotDefaultAvatar(),
      streamerId: post.user_id,
      thumbnail: spotSafeImage(post.image_url),
      viewers: post.likes || 0,
      category: (post as any).post_kind === 'sell' ? 'Marketplace' : 'Creative',
      tags: (post as any).post_kind ? [(post as any).post_kind] : ['post'],
      isLive: true,
      description: post.content || undefined,
      sourceType: 'post',
      sourceId: post.id,
      likes: post.likes || 0,
      commentsCount: post.comments || 0,
      createdAt: post.created_at,
    });
  }

  // Upcoming: remaining bundles (skip featured)
  const upcomingBundles = featuredBundle
    ? (bundles || []).filter((b) => b.id !== featuredBundle.id).slice(0, 4)
    : (bundles || []).slice(1, 5);

  for (const bundle of upcomingBundles) {
    cards.push({
      id: `upcoming-${bundle.id}`,
      type: 'upcoming',
      title: bundle.title,
      streamerName: bundle.provider_name || 'Available Soon',
      streamerAvatar: bundle.provider_avatar || spotDefaultAvatar(),
      streamerId: bundle.user_id || '',
      thumbnail: spotSafeImage(bundle.image),
      viewers: 0,
      category: bundle.category || 'Lifestyle',
      tags: bundle.items?.map((i: any) => i.title || '').filter(Boolean).slice(0, 2) || [],
      isLive: false,
      scheduledFor: 'Available now',
      description: bundle.description || undefined,
      sourceType: 'bundle',
      sourceId: bundle.id,
      price: bundle.bundle_price || bundle.price || undefined,
      createdAt: bundle.created_at,
    });
  }

  // Past Broadcasts: older posts beyond live/featured
  const pastStartIndex = (featuredPost ? 1 : 0) + livePosts.length;
  const pastPosts = (posts || []).slice(pastStartIndex, pastStartIndex + 8);

  for (const post of pastPosts) {
    const user = (post as any).user;
    const age = spotTimeAgo(post.created_at);
    cards.push({
      id: `past-${post.id}`,
      type: 'past',
      title: post.content || 'Memory',
      streamerName: user?.name || user?.username || 'User',
      streamerAvatar: user?.avatar || spotDefaultAvatar(),
      streamerId: post.user_id,
      thumbnail: spotSafeImage(post.image_url),
      viewers: post.likes || 0,
      category: (post as any).post_kind === 'sell' ? 'Marketplace' : 'Creative',
      tags: (post as any).post_kind ? [(post as any).post_kind] : ['memory'],
      isLive: false,
      duration: age,
      sourceType: 'post',
      sourceId: post.id,
      likes: post.likes || 0,
      commentsCount: post.comments || 0,
      createdAt: post.created_at,
    });
  }

  return {
    cards,
    summary: {
      total: cards.length,
      liveCount: cards.filter((c) => c.type === 'live').length,
      featuredCount: cards.filter((c) => c.type === 'featured').length,
      upcomingCount: cards.filter((c) => c.type === 'upcoming').length,
      pastCount: cards.filter((c) => c.type === 'past').length,
    },
  };
}

export { API_BASE };
