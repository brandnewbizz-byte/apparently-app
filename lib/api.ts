import { Platform } from 'react-native';

// Use the localtunnel URL from env, or fall back to hardcoded
const getApiBase = () => {
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_LOCAL_API_URL) {
    return process.env.EXPO_PUBLIC_LOCAL_API_URL;
  }
  return 'https://late-dodos-wait.loca.lt/api';
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

export async function createPost(userId: string, content: string, imageUrl?: string) {
  return fetchJSON(`${API_BASE}/posts`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId || DEFAULT_USER_ID, content, image_url: imageUrl }),
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

// ─── Plans ───
export async function getPlans(userId: string) {
  return fetchJSON(`${API_BASE}/plans?user_id=${encodeURIComponent(userId || DEFAULT_USER_ID)}`);
}

export async function createPlan(plan: any) {
  return fetchJSON(`${API_BASE}/plans`, { method: 'POST', body: JSON.stringify(plan) });
}

export { DEFAULT_USER_ID };
