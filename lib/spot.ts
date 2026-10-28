/**
 * Spot — live virtual rooms where friends hang out and plan together.
 *
 * A room is a shared canvas. Everything placed in it (stickers, notes,
 * photos, doodles) is a row in `virtual_room_objects`, so the room is still
 * there when people come back. Positions are stored normalised (0–1) so the
 * room looks the same on every screen size.
 *
 * Live behaviour uses one Supabase Realtime channel per room:
 *   • presence   → who's in the room
 *   • broadcast  → in-flight moves, strokes being drawn, reaction bursts
 *   • db changes → items added / moved / removed by others
 */
import { supabase } from '@/lib/supabase';

// ── Themes ────────────────────────────────────────────────────────────────
export interface SpotTheme {
  id: string;
  name: string;
  emoji: string;
  colors: [string, string];
  /** Dot-grid / ink colour that reads well on this background. */
  ink: string;
  dark: boolean;
}

export const SPOT_THEMES: SpotTheme[] = [
  { id: 'lounge', name: 'Lounge', emoji: '🛋️', colors: ['#2B1B4A', '#5B2A86'], ink: 'rgba(255,255,255,0.12)', dark: true },
  { id: 'beach', name: 'Beach', emoji: '🏖️', colors: ['#7DD3FC', '#FDE68A'], ink: 'rgba(0,0,0,0.08)', dark: false },
  { id: 'garden', name: 'Garden', emoji: '🌿', colors: ['#A7F3D0', '#4ADE80'], ink: 'rgba(0,0,0,0.08)', dark: false },
  { id: 'night', name: 'Night', emoji: '🌙', colors: ['#0B1026', '#1E3A8A'], ink: 'rgba(255,255,255,0.10)', dark: true },
  { id: 'party', name: 'Party', emoji: '🎉', colors: ['#F472B6', '#FB923C'], ink: 'rgba(255,255,255,0.15)', dark: true },
  { id: 'paper', name: 'Whiteboard', emoji: '📝', colors: ['#FAFAF9', '#F1F5F9'], ink: 'rgba(0,0,0,0.07)', dark: false },
];

export const themeFor = (id?: string | null): SpotTheme =>
  SPOT_THEMES.find((t) => t.id === id) || SPOT_THEMES[0];

// ── Things you can drop into a room ─────────────────────────────────────────
export const STICKER_GROUPS: { title: string; items: string[] }[] = [
  { title: 'Hang out', items: ['🛋️', '🪑', '🪴', '🕯️', '📺', '🎮', '🎧', '🎸', '🛏️', '🖼️', '🪩', '⛺'] },
  { title: 'Food & drinks', items: ['🍕', '🍔', '🌮', '🍣', '🍿', '🎂', '🧁', '🍩', '🍾', '🥂', '☕', '🧃'] },
  { title: 'Plans & trips', items: ['✈️', '🚗', '🏖️', '⛰️', '🏕️', '🎟️', '🗺️', '📍', '🧳', '📸', '🏨', '🚤'] },
  { title: 'Party', items: ['🎈', '🎁', '🎉', '🎊', '🪅', '🎤', '💃', '🕺', '🔥', '✨', '⭐', '💖'] },
];

export const NOTE_COLORS = ['#FEF08A', '#BBF7D0', '#BFDBFE', '#FBCFE8', '#FED7AA', '#E9D5FF'];
export const PEN_COLORS = ['#111827', '#FFFFFF', '#EF4444', '#F59E0B', '#22C55E', '#3B82F6', '#A855F7', '#EC4899'];
export const REACTIONS = ['❤️', '😂', '🔥', '👏', '😍', '🎉'];

// ── Types ─────────────────────────────────────────────────────────────────
export type SpotItemKind = 'sticker' | 'note' | 'photo' | 'doodle';

export interface SpotPoint { x: number; y: number }

export interface SpotItem {
  id: string;
  roomId: string;
  kind: SpotItemKind;
  /** Centre position, normalised 0–1 (unused for doodles). */
  x: number;
  y: number;
  scale: number;
  rotation: number;
  z: number;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  // kind-specific
  emoji?: string;
  text?: string;
  color?: string;
  imageUrl?: string;
  points?: SpotPoint[];
  width?: number;
  /** Photo cut-out outline, normalised to the image (0–1). */
  cutout?: SpotPoint[];
  /** Photo width / height. */
  aspect?: number;
  /** Photo shown without a frame (e.g. an already cut-out PNG sticker). */
  bare?: boolean;
  /** emoji → user ids who reacted with it */
  reactions: Record<string, string[]>;
}

export interface SpotRoom {
  id: string;
  name: string;
  theme: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string | null;
  visibility: 'public' | 'invite_only' | 'private';
  createdAt: string;
  updatedAt: string;
}

// ── Mapping ───────────────────────────────────────────────────────────────
function mapRoom(r: any): SpotRoom {
  return {
    id: r.id,
    name: r.name || 'Untitled room',
    theme: r.environment || 'lounge',
    creatorId: r.creator_id,
    creatorName: r.creator_name || 'Someone',
    creatorAvatar: r.creator_avatar || null,
    visibility: r.visibility || 'public',
    createdAt: r.created_at,
    updatedAt: r.updated_at || r.created_at,
  };
}

export function mapItem(r: any): SpotItem {
  const m = r.metadata || {};
  const kind: SpotItemKind = (['sticker', 'note', 'photo', 'doodle'].includes(r.object_type) ? r.object_type : 'sticker') as SpotItemKind;
  return {
    id: r.id,
    roomId: r.room_id,
    kind,
    x: clamp01(Number(r.position_x ?? 0.5)),
    y: clamp01(Number(r.position_y ?? 0.5)),
    scale: Number(r.scale) || 1,
    rotation: Number(r.rotation) || 0,
    z: Number(r.z_index) || 0,
    ownerId: r.owner_id,
    ownerName: r.owner_name || 'Someone',
    createdAt: r.created_at,
    emoji: m.emoji,
    text: r.notes ?? m.text,
    color: m.color,
    imageUrl: r.image_url || undefined,
    points: Array.isArray(m.points) ? m.points : undefined,
    width: Number(m.width) || undefined,
    cutout: Array.isArray(m.cutout) && m.cutout.length > 2 ? m.cutout : undefined,
    aspect: Number(m.aspect) || undefined,
    bare: !!m.bare,
    reactions: (m.reactions && typeof m.reactions === 'object') ? m.reactions : {},
  };
}

export const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0.5));

// ── Rooms ─────────────────────────────────────────────────────────────────
/** Rooms you made + open rooms from others, most recently active first. */
export async function listRooms(myId?: string): Promise<SpotRoom[]> {
  const { data, error } = await supabase
    .from('rooms')
    .select('id, name, environment, creator_id, creator_name, creator_avatar, visibility, created_at, updated_at')
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(60);
  if (error) throw error;
  return (data || [])
    .map(mapRoom)
    .filter((r) => r.creatorId === myId || r.visibility === 'public');
}

export async function getRoom(id: string): Promise<SpotRoom | null> {
  const { data } = await supabase
    .from('rooms')
    .select('id, name, environment, creator_id, creator_name, creator_avatar, visibility, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();
  return data ? mapRoom(data) : null;
}

export async function createRoom(input: {
  name: string; theme: string; visibility: 'public' | 'invite_only';
  me: { id: string; name: string; avatar?: string | null };
}): Promise<SpotRoom> {
  const id = `room_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('rooms')
    .insert({
      id,
      name: input.name.trim() || 'Hangout',
      topic: '',
      environment: input.theme,
      visibility: input.visibility,
      status: 'live',
      creator_id: input.me.id,
      creator_name: input.me.name,
      creator_avatar: input.me.avatar || null,
      participants: [],
      created_at: now,
      updated_at: now,
    })
    .select('id, name, environment, creator_id, creator_name, creator_avatar, visibility, created_at, updated_at')
    .single();
  if (error) throw error;
  return mapRoom(data);
}

export async function updateRoom(id: string, patch: { name?: string; theme?: string }) {
  const row: any = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.theme !== undefined) row.environment = patch.theme;
  const { error } = await supabase.from('rooms').update(row).eq('id', id);
  if (error) throw error;
}

export async function deleteRoom(id: string) {
  const { error } = await supabase.from('rooms').delete().eq('id', id);
  if (error) throw error;
}

/** Bump the room so it rises to the top of the lobby (only the owner can). */
export function touchRoom(room: SpotRoom, myId: string) {
  if (room.creatorId !== myId) return;
  supabase.from('rooms').update({ updated_at: new Date().toISOString() }).eq('id', room.id).then(() => {});
}

// ── Items ─────────────────────────────────────────────────────────────────
export async function listItems(roomId: string): Promise<SpotItem[]> {
  const { data, error } = await supabase
    .from('virtual_room_objects')
    .select('*')
    .eq('room_id', roomId)
    .order('z_index', { ascending: true })
    .limit(800);
  if (error) throw error;
  return (data || []).map(mapItem);
}

export async function addItem(roomId: string, me: { id: string; name: string }, item: {
  kind: SpotItemKind; x?: number; y?: number; z: number; scale?: number; rotation?: number;
  emoji?: string; text?: string; color?: string; imageUrl?: string; points?: SpotPoint[]; width?: number;
  cutout?: SpotPoint[]; aspect?: number; bare?: boolean;
}): Promise<SpotItem> {
  const { data, error } = await supabase
    .from('virtual_room_objects')
    .insert({
      room_id: roomId,
      object_type: item.kind,
      name: item.kind === 'sticker' ? item.emoji || 'sticker' : item.kind,
      notes: item.kind === 'note' ? item.text || '' : null,
      image_url: item.imageUrl || null,
      position_x: clamp01(item.x ?? 0.5),
      position_y: clamp01(item.y ?? 0.5),
      width: 0,
      height: 0,
      rotation: item.rotation || 0,
      scale: item.scale || 1,
      z_index: item.z,
      owner_id: me.id,
      owner_name: me.name,
      metadata: {
        emoji: item.emoji, text: item.text, color: item.color,
        points: item.points, width: item.width, cutout: item.cutout, aspect: item.aspect, bare: item.bare || undefined, reactions: {},
      },
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapItem(data);
}

export async function moveItem(id: string, x: number, y: number, z: number) {
  const { error } = await supabase
    .from('virtual_room_objects')
    .update({ position_x: clamp01(x), position_y: clamp01(y), z_index: z, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function updateItemMeta(item: SpotItem, patch: Partial<Pick<SpotItem, 'reactions' | 'scale' | 'rotation' | 'text'>>) {
  const row: any = { updated_at: new Date().toISOString() };
  if (patch.scale !== undefined) row.scale = patch.scale;
  if (patch.rotation !== undefined) row.rotation = patch.rotation;
  if (patch.text !== undefined) row.notes = patch.text;
  row.metadata = {
    emoji: item.emoji, text: patch.text ?? item.text, color: item.color,
    points: item.points, width: item.width, cutout: item.cutout, aspect: item.aspect, bare: item.bare || undefined,
    reactions: patch.reactions ?? item.reactions,
  };
  const { error } = await supabase.from('virtual_room_objects').update(row).eq('id', item.id);
  if (error) throw error;
}

export async function removeItem(id: string) {
  const { error } = await supabase.from('virtual_room_objects').delete().eq('id', id);
  if (error) throw error;
}

/** Toggle my reaction on an item; returns the new reactions map. */
export function toggleReaction(reactions: Record<string, string[]>, emoji: string, me: string) {
  const next: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(reactions || {})) next[k] = [...v];
  const list = next[emoji] || [];
  next[emoji] = list.includes(me) ? list.filter((u) => u !== me) : [...list, me];
  if (!next[emoji].length) delete next[emoji];
  return next;
}

export const roomLink = (id: string) => `rork-app://live/room/${id}`;


// ── Invites ───────────────────────────────────────────────────────────────
export interface SpotPerson { id: string; name: string; username: string; avatar: string | null }
export interface SpotInvite {
  id: string;
  roomId: string;
  roomName: string;
  theme: string;
  fromId: string;
  fromName: string;
  fromAvatar: string | null;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

const mapPerson = (p: any): SpotPerson => ({
  id: p.id, name: p.full_name || p.username || 'Someone', username: p.username || '', avatar: p.avatar || null,
});

/** People I follow or who follow me (best invite candidates), or a search. */
export async function findPeople(myId: string, query = ''): Promise<SpotPerson[]> {
  const q = query.trim().replace(/[%,()]/g, '');
  if (q) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar')
      .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
      .neq('id', myId)
      .limit(25);
    return (data || []).map(mapPerson);
  }
  const { data: f } = await supabase
    .from('follows')
    .select('follower_id, following_id')
    .or(`follower_id.eq.${myId},following_id.eq.${myId}`)
    .order('created_at', { ascending: false })
    .limit(200);
  const ids = Array.from(new Set((f || []).map((r: any) => (r.follower_id === myId ? r.following_id : r.follower_id)))).filter((id) => id && id !== myId);
  if (!ids.length) return [];
  const { data } = await supabase.from('profiles').select('id, full_name, username, avatar').in('id', ids.slice(0, 100));
  return (data || []).map(mapPerson).sort((a, b) => a.name.localeCompare(b.name));
}

export async function sendRoomInvites(room: Pick<SpotRoom, 'id' | 'name' | 'theme'>, me: { id: string; name: string; avatar?: string | null }, people: SpotPerson[]) {
  if (!people.length) return 0;
  const rows = people.map((p) => ({
    user_id: p.id,
    type: 'room_invite',
    title: 'Spot invite',
    body: `${me.name} invited you to "${room.name}"`,
    actor_id: me.id,
    actor_name: me.name,
    actor_avatar: me.avatar || null,
    read: false,
    data: { room_id: room.id, room_name: room.name, theme: room.theme, status: 'pending' },
  }));
  const { error } = await supabase.from('notifications').insert(rows);
  if (error) throw error;
  return rows.length;
}

function mapInvite(n: any): SpotInvite {
  const d = n.data || {};
  return {
    id: n.id,
    roomId: d.room_id,
    roomName: d.room_name || 'A Spot room',
    theme: d.theme || 'lounge',
    fromId: n.actor_id,
    fromName: n.actor_name || 'Someone',
    fromAvatar: n.actor_avatar || null,
    status: d.status === 'accepted' || d.status === 'declined' ? d.status : 'pending',
    createdAt: n.created_at,
  };
}

export async function listInvites(myId: string): Promise<SpotInvite[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, data, actor_id, actor_name, actor_avatar, created_at')
    .eq('user_id', myId)
    .eq('type', 'room_invite')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  const seen = new Set<string>();
  // Newest invite per room only.
  return (data || []).map(mapInvite).filter((i) => i.roomId && !seen.has(i.roomId) && seen.add(i.roomId));
}

/** Accept or decline an invite. Lets the host know when someone accepts. */
export async function answerInvite(inviteId: string, accept: boolean, me: { id: string; name: string; avatar?: string | null }) {
  const { data: row } = await supabase.from('notifications').select('id, data, actor_id').eq('id', inviteId).maybeSingle();
  if (!row) throw new Error('Invite not found');
  const data = { ...(row.data || {}), status: accept ? 'accepted' : 'declined' };
  const { error } = await supabase.from('notifications').update({ data, read: true }).eq('id', inviteId);
  if (error) throw error;
  if (accept && row.actor_id) {
    await supabase.from('notifications').insert({
      user_id: row.actor_id,
      type: 'general',
      title: 'Invite accepted',
      body: `${me.name} joined your room "${data.room_name || 'Spot'}"`,
      actor_id: me.id,
      actor_name: me.name,
      actor_avatar: me.avatar || null,
      read: false,
      data: { room_id: data.room_id, room_name: data.room_name, kind: 'room_invite_accepted' },
    });
  }
  return data;
}

export async function getRooms(ids: string[]): Promise<SpotRoom[]> {
  if (!ids.length) return [];
  const { data } = await supabase
    .from('rooms')
    .select('id, name, environment, creator_id, creator_name, creator_avatar, visibility, created_at, updated_at')
    .in('id', ids);
  return (data || []).map(mapRoom);
}
