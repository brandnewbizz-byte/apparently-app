// ═══════════════════════════════════════════════════════════════════════════
// API Module — Supabase Live Backend
// All calls go directly to Supabase (live), not the local dev server.
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from '@/supabaseClient';

export const LOCAL_API = 'https://inejlmksbzujgpwvnnch.supabase.co';
const API_BASE = LOCAL_API;
export const DEFAULT_USER_ID = 'u-dev';

// ─── Posts ───
export async function getPosts() {
  // Join with users table so author name/avatar are always correct
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      user:user_id (
        id,
        name,
        username,
        avatar,
        is_verified,
        followers_count,
        relationship_category
      )
    `)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data || [];
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
      user_id: userId || DEFAULT_USER_ID,
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
      user_id: userId || DEFAULT_USER_ID,
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
    .eq('user_id', userId || DEFAULT_USER_ID)
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
        user_id: userId || DEFAULT_USER_ID,
      });
    if (error) throw error;
    return { liked: true };
  }
}

export async function getLikeStatus(postId: string, userId?: string) {
  const uid = userId || DEFAULT_USER_ID;
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
      author_id: authorId || DEFAULT_USER_ID,
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
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getUser(userId: string) {
  const { data, error } = await supabase
    .from('users')
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
    .eq('user_id', userId || DEFAULT_USER_ID)
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
    .eq('user_id', userId || DEFAULT_USER_ID)
    .order('due_date', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ─── Relationships ───
export async function getRelationships(userId: string) {
  const { data, error } = await supabase
    .from('relationships')
    .select('*')
    .eq('user_id', userId || DEFAULT_USER_ID)
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
    .eq('user_id', userId || DEFAULT_USER_ID)
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

export { API_BASE };
