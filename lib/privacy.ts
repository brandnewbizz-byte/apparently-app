/**
 * Private account + follow requests (Instagram-style). The server enforces it:
 * see supabase/migrations/034_private_profiles.sql.
 */
import { supabase } from '@/lib/supabase';

export interface FollowRequest { followerId: string; name: string; username: string; avatar: string | null; at: string }

export async function getPrivate(userId: string): Promise<boolean> {
  const { data } = await supabase.from('profiles').select('is_private').eq('id', userId).maybeSingle();
  return !!(data as any)?.is_private;
}

export async function setPrivate(userId: string, on: boolean): Promise<boolean> {
  const { error } = await supabase.from('profiles').update({ is_private: on }).eq('id', userId);
  return !error;
}

export async function listFollowRequests(userId: string): Promise<FollowRequest[]> {
  const { data } = await supabase
    .from('follows')
    .select('follower_id, created_at')
    .eq('following_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(200);
  const rows = (data || []) as any[];
  if (!rows.length) return [];
  const { data: people } = await supabase.from('profiles').select('id, full_name, username, avatar').in('id', rows.map((r) => r.follower_id));
  const map = new Map((people || []).map((p: any) => [p.id, p]));
  return rows.map((r) => {
    const p: any = map.get(r.follower_id) || {};
    return { followerId: r.follower_id, name: p.full_name || p.username || 'Someone', username: p.username || '', avatar: p.avatar || null, at: r.created_at };
  });
}

/** Approve a follow request and let them know. */
export async function approveFollow(me: { id: string; name: string; avatar?: string | null }, followerId: string): Promise<boolean> {
  const { error } = await supabase.from('follows').update({ status: 'accepted' }).eq('following_id', me.id).eq('follower_id', followerId);
  if (error) return false;
  supabase.from('notifications').insert({
    user_id: followerId,
    actor_id: me.id,
    actor_name: me.name,
    actor_avatar: me.avatar || null,
    type: 'follow',
    title: `${me.name} accepted your follow request`,
    body: 'accepted your follow request',
    data: { kind: 'follow_accepted', follower_id: me.id },
    read: false,
    created_at: new Date().toISOString(),
  }).then(() => {}, () => {});
  return true;
}

/** Decline a request (or remove a follower). */
export async function declineFollow(myId: string, followerId: string): Promise<boolean> {
  const { error } = await supabase.from('follows').delete().eq('following_id', myId).eq('follower_id', followerId);
  return !error;
}
