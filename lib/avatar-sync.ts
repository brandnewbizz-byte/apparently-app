import { supabase } from '@/lib/supabase';

/**
 * Propagate a user's avatar to every table that denormalized a snapshot of it.
 *
 * The single source of truth is `profiles.avatar`. But several features copy the
 * avatar into their own rows at creation time (rooms.creator_avatar, the
 * participants JSON list, notifications.actor_avatar, live_streams.streamer_avatar,
 * etc.). Without this, changing your profile picture leaves every old copy stale.
 *
 * Fire-and-forget, best-effort, never throws. RLS will silently reject updates the
 * user isn't allowed to make (e.g. another user's room they're not hosting) — that's
 * expected and safe.
 */
export async function syncUserAvatar(userId: string, avatarUrl: string): Promise<void> {
  if (!userId || !avatarUrl) return;

  // swallow every error — best-effort propagation only
  // (Supabase query builders are thenable, not literal Promise objects)
  const fire = (p: PromiseLike<any>) => { try { p.then(() => {}, () => {}); } catch {} };

  // rooms.creator_avatar — rooms this user created
  fire(supabase.from('rooms').update({ creator_avatar: avatarUrl }).eq('creator_id', userId));

  // rooms.participants (JSON array) — update this user's entry in any room they're in
  try {
    supabase.from('rooms')
      .select('id, participants')
      .contains('participants', [{ userId }])
      .then(({ data }) => {
        (data || []).forEach((room: any) => {
          let parts: any[] = [];
          try {
            parts = typeof room.participants === 'string'
              ? JSON.parse(room.participants)
              : (room.participants || []);
          } catch {}
          if (!Array.isArray(parts)) return;
          const next = parts.map((p: any) =>
            p && p.userId === userId ? { ...p, avatar: avatarUrl } : p
          );
          fire(supabase.from('rooms').update({ participants: JSON.stringify(next) }).eq('id', room.id));
        });
      });
  } catch {}

  // notifications.actor_avatar — notifications this user triggered
  fire(supabase.from('notifications').update({ actor_avatar: avatarUrl }).eq('actor_id', userId));

  // live_streams.streamer_avatar
  fire(supabase.from('live_streams').update({ streamer_avatar: avatarUrl }).eq('streamer_id', userId));

  // user_grabs.provider_avatar
  fire(supabase.from('user_grabs').update({ provider_avatar: avatarUrl }).eq('provider_id', userId));

  // bundles.provider_avatar (provider can be tracked by provider_id or creator_id)
  fire(supabase.from('bundles').update({ provider_avatar: avatarUrl }).eq('provider_id', userId));
  fire(supabase.from('bundles').update({ provider_avatar: avatarUrl }).eq('creator_id', userId));

  // product_inquiries.user_avatar
  fire(supabase.from('product_inquiries').update({ user_avatar: avatarUrl }).eq('user_id', userId));

  // job_requests.accepted_by_avatar
  fire(supabase.from('job_requests').update({ accepted_by_avatar: avatarUrl }).eq('accepted_by', userId));

  // users (legacy) table avatar
  fire(supabase.from('users').update({ avatar: avatarUrl }).eq('id', userId));
}
