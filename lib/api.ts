import { Platform } from 'react-native';

// Use the localtunnel URL from env, or fall back to hardcoded
const getApiBase = () => {
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_LOCAL_API_URL) {
    return process.env.EXPO_PUBLIC_LOCAL_API_URL;
  }
  return 'https://great-cloths-feel.loca.lt/api';
};

export const LOCAL_API = getApiBase();
const API_BASE = LOCAL_API;
const DEFAULT_USER_ID = 'u-dev';

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

// ─── Posts ───
export async function getPosts() {
  return fetchJSON(`${API_BASE}/posts`);
}

export async function createPost(
  userId: string,
  content: string,
  imageUrl?: string,
  options?: { postKind?: 'post' | 'sell'; category?: string }
) {
  return fetchJSON(`${API_BASE}/posts`, {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId || DEFAULT_USER_ID,
      content,
      image_url: imageUrl,
      post_kind: options?.postKind || 'post',
      category: options?.category,
    }),
  });
}

export async function deletePost(postId: string) {
  return fetchJSON(`${API_BASE}/posts/${postId}`, { method: 'DELETE' });
}

// ─── Stories ───
export async function getStories() {
  return fetchJSON(`${API_BASE}/stories`);
}

export async function createStory(userId: string, imageUrl: string, backgroundColor?: string, textContent?: string) {
  return fetchJSON(`${API_BASE}/stories`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId || DEFAULT_USER_ID, image_url: imageUrl, background_color: backgroundColor, text_content: textContent }),
  });
}

// ─── Likes ───
export async function toggleLike(postId: string, userId: string) {
  return fetchJSON(`${API_BASE}/likes`, {
    method: 'POST',
    body: JSON.stringify({ post_id: postId, user_id: userId || DEFAULT_USER_ID }),
  });
}

export async function getLikeStatus(postId: string, userId?: string) {
  const params = userId ? `?user_id=${userId}` : '';
  return fetchJSON(`${API_BASE}/likes/${postId}${params}`);
}

// ─── Comments ───
export async function getComments(postId: string) {
  return fetchJSON(`${API_BASE}/comments/${postId}`);
}

export async function addComment(postId: string, authorId: string, text: string, parentId?: string) {
  return fetchJSON(`${API_BASE}/comments`, {
    method: 'POST',
    body: JSON.stringify({ post_id: postId, author_id: authorId || DEFAULT_USER_ID, text, parent_id: parentId }),
  });
}

// ─── Users ───
export async function getUsers() {
  return fetchJSON(`${API_BASE}/users`);
}

export async function getUser(userId: string) {
  return fetchJSON(`${API_BASE}/users/${userId}`);
}

// ─── Listings ───
export async function getListings(category?: string) {
  const params = category ? `?category=${category}` : '';
  return fetchJSON(`${API_BASE}/listings${params}`);
}

// ─── Products ───
export async function getProducts() {
  return fetchJSON(`${API_BASE}/products`);
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
  return fetchJSON(`${API_BASE}/products`, { method: 'POST', body: JSON.stringify(product) });
}

// ─── Calendar Events ───
export async function getCalendarEvents(userId: string) {
  return fetchJSON(`${API_BASE}/calendar-events?user_id=${encodeURIComponent(userId || DEFAULT_USER_ID)}`);
}

export async function createCalendarEvent(event: any) {
  return fetchJSON(`${API_BASE}/calendar-events`, { method: 'POST', body: JSON.stringify(event) });
}

// ─── Bills ───
export async function getBills(userId: string) {
  return fetchJSON(`${API_BASE}/bills?user_id=${encodeURIComponent(userId || DEFAULT_USER_ID)}`);
}

// ─── Relationships ───
export async function getRelationships(userId: string) {
  return fetchJSON(`${API_BASE}/relationships?user_id=${encodeURIComponent(userId || DEFAULT_USER_ID)}`);
}

// ─── Swap ───
export async function getSwapPosts() {
  return fetchJSON(`${API_BASE}/swap-posts`);
}

export async function createSwapPost(post: any) {
  return fetchJSON(`${API_BASE}/swap-posts`, { method: 'POST', body: JSON.stringify(post) });
}

// ─── Bookings ───
export async function getBookings(userId?: string) {
  const params = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
  return fetchJSON(`${API_BASE}/bookings${params}`);
}

export async function createBooking(booking: any) {
  return fetchJSON(`${API_BASE}/bookings`, { method: 'POST', body: JSON.stringify(booking) });
}

// ─── Plans ───
export async function getPlans(userId: string) {
  return fetchJSON(`${API_BASE}/plans?user_id=${encodeURIComponent(userId || DEFAULT_USER_ID)}`);
}

export async function createPlan(plan: any) {
  return fetchJSON(`${API_BASE}/plans`, { method: 'POST', body: JSON.stringify(plan) });
}

export async function deletePlan(planId: string) {
  return fetchJSON(`${API_BASE}/plans/${planId}`, { method: 'DELETE' });
}

// ─── Swap Matches ───
export async function getSwapMatches(userId?: string) {
  const params = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
  return fetchJSON(`${API_BASE}/swap-matches${params}`);
}

export async function createSwapMatch(match: any) {
  return fetchJSON(`${API_BASE}/swap-matches`, { method: 'POST', body: JSON.stringify(match) });
}

export async function updateSwapMatch(matchId: string, updates: any) {
  return fetchJSON(`${API_BASE}/swap-matches/${matchId}`, { method: 'PUT', body: JSON.stringify(updates) });
}

// ─── Connection Requests ───
export async function getConnectionRequests(userId?: string) {
  const params = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
  return fetchJSON(`${API_BASE}/connection-requests${params}`);
}

export async function createConnectionRequest(req: any) {
  return fetchJSON(`${API_BASE}/connection-requests`, { method: 'POST', body: JSON.stringify(req) });
}

// ─── Income Sources ───
export async function createIncomeSource(source: any) {
  return fetchJSON(`${API_BASE}/income-sources`, { method: 'POST', body: JSON.stringify(source) });
}

// ─── Skill Deals ───
export async function getSkillDeals() {
  return fetchJSON(`${API_BASE}/skill-deals`);
}

export async function createSkillDeal(deal: {
  creator_id: string; creator_name: string; creator_avatar: string;
  title: string; description: string; price: number; icon: string;
  image_url?: string; category?: string;
}) {
  return fetchJSON(`${API_BASE}/skill-deals`, { method: 'POST', body: JSON.stringify(deal) });
}

// ─── Bundles ───
export async function getBundles() {
  return fetchJSON(`${API_BASE}/bundles`);
}

export async function createBundle(bundle: {
  creator_id: string; creator_name: string; creator_avatar: string;
  title: string; description: string; price: number;
  items: string[]; image_url?: string; category?: string;
}) {
  return fetchJSON(`${API_BASE}/bundles`, { method: 'POST', body: JSON.stringify(bundle) });
}

export { DEFAULT_USER_ID };
