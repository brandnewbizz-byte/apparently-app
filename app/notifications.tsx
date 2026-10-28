import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight, Heart, Phone, UserPlus, Video, X, Check } from 'lucide-react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications, AppNotification } from '@/contexts/NotificationsContext';
import { useConnections, ConnectionRequest } from '@/contexts/ConnectionsContext';
import { supabase } from '@/lib/supabase';

// ── Helpers ────────────────────────────────────────────────────────────────

function shortAgo(ts: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
  if (s < 60) return `${s || 1}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / 604800)}w`;
}

function sectionFor(n: AppNotification): string {
  if (!n.read) return 'New';
  const age = Date.now() - new Date(n.createdAt).getTime();
  const day = 86400000;
  if (age < day) return 'Today';
  if (age < 7 * day) return 'This week';
  if (age < 30 * day) return 'This month';
  return 'Earlier';
}
const SECTION_ORDER = ['New', 'Today', 'This week', 'This month', 'Earlier'];

function priceLabel(raw: any): string {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'string') return raw.startsWith('$') ? raw : `$${raw}`;
  const n = Number(raw);
  if (!n) return '';
  return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}

/** What the notification says after the actor's name. */
function describe(n: AppNotification): string {
  const d = n.data || {};
  switch (n.type) {
    case 'like': return 'liked your post.';
    case 'comment': return n.body?.startsWith('commented') ? `${n.body}` : 'commented on your post.';
    case 'mention': return `mentioned you in a ${d.content_type || 'post'}.`;
    case 'follow': return 'started following you.';
    case 'bundle_grab': {
      const p = priceLabel(d.bundle_price);
      return `grabbed your bundle${d.bundle_title ? ` "${d.bundle_title}"` : ''}${p ? ` · ${p}` : ''}.`;
    }
    case 'skill_grab': {
      const p = priceLabel(d.skill_price);
      return `booked your skill${d.skill_title ? ` "${d.skill_title}"` : ''}${p ? ` · ${p}` : ''}.`;
    }
    case 'service_grab':
    case 'service_response': return d.source === 'job'
      ? `took your request${d.request_title ? ` "${d.request_title}"` : ''}.`
      : `offered to help with${d.request_title ? ` "${d.request_title}"` : ' your request'}.`;
    case 'job_grabbed': return `grabbed your ${d.job_label || 'job'}${d.job_title ? ` "${d.job_title}"` : ''}.`;
    case 'call_request': return 'is calling you.';
    case 'room_invite': return 'invited you to a live room.';
    default: return n.body || n.title || '';
  }
}

function thumbnailFor(n: AppNotification): string {
  const d = n.data || {};
  return d.post_image_url || d.bundle_image || d.skill_image || d.request_image || '';
}

function Avatar({ uri, size = 44, bg, iconColor }: { uri?: string; size?: number; bg: string; iconColor: string }) {
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg }} />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <UserPlus size={size * 0.42} color={iconColor} />
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { notifications, isLoading, refresh, markAllRead, markRead, remove } = useNotifications();
  const connections = useConnections();
  const [refreshing, setRefreshing] = useState(false);
  const params = useLocalSearchParams<{ requests?: string }>();
  const [showRequests, setShowRequests] = useState(params.requests === '1');
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [followBusy, setFollowBusy] = useState<string | null>(null);

  // Instagram marks activity as seen when you leave the screen — "New"
  // stays highlighted while you look at it.
  const markAllReadRef = useRef(markAllRead);
  useEffect(() => { markAllReadRef.current = markAllRead; }, [markAllRead]);
  useEffect(() => () => { markAllReadRef.current(); }, []);

  // Which of the people in my notifications do I already follow? (Follow back buttons)
  const actorIds = useMemo(
    () => Array.from(new Set(notifications.filter((n) => n.type === 'follow' && n.actorId).map((n) => n.actorId as string))),
    [notifications],
  );
  useEffect(() => {
    if (!user?.id || actorIds.length === 0) return;
    supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)
      .in('following_id', actorIds)
      .then(({ data }) => {
        if (data) setFollowing(new Set(data.map((r: any) => r.following_id)));
      });
  }, [user?.id, actorIds]);

  const toggleFollow = useCallback(async (actorId: string) => {
    if (!user?.id || followBusy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFollowBusy(actorId);
    const isFollowing = following.has(actorId);
    try {
      if (isFollowing) {
        const { error } = await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', actorId);
        if (error) throw error;
        setFollowing((prev) => { const n = new Set(prev); n.delete(actorId); return n; });
      } else {
        const { error } = await supabase.from('follows').insert({ follower_id: user.id, following_id: actorId });
        if (error && error.code !== '23505') throw error;
        setFollowing((prev) => new Set(prev).add(actorId));
        if (!error) {
          const actorName = user.fullName || user.username || 'Someone';
          supabase.from('notifications').insert({
            user_id: actorId, actor_id: user.id, actor_name: actorName, actor_avatar: user.avatar || '',
            type: 'follow', title: `${actorName} started following you`, body: 'started following you',
            data: {}, read: false,
          }).then(() => {});
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not update follow.');
    } finally {
      setFollowBusy(null);
    }
  }, [user, following, followBusy]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const sections = useMemo(() => {
    const groups: Record<string, AppNotification[]> = {};
    for (const n of notifications) {
      const key = sectionFor(n);
      (groups[key] ||= []).push(n);
    }
    return SECTION_ORDER.filter((k) => groups[k]?.length).map((k) => ({ title: k, data: groups[k] }));
  }, [notifications]);

  const openNotification = (n: AppNotification) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!n.read) markRead(n.id);
    if (n.type === 'bundle_grab' || n.type === 'skill_grab' || n.type === 'service_grab' || n.type === 'service_response') {
      if (n.actorId) router.push(`/inbox/conversation/${n.actorId}` as any);
      return;
    }
    if (n.type === 'room_invite') {
      const roomId = n.data?.room_id;
      if (roomId) router.push(`/(tabs)/live/room/${roomId}` as any);
      return;
    }
    if (n.type === 'call_request') return;
    if (n.actorId) router.push(`/user/${n.actorId}` as any);
  };

  const answerCall = (n: AppNotification) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    markRead(n.id);
    router.push({
      pathname: '/call/[roomId]' as any,
      params: {
        roomId: n.data?.room_id || `call-${Date.now()}`,
        callerId: n.actorId,
        callerName: n.actorName,
        targetId: user?.id,
        targetName: user?.fullName || 'You',
        isOutgoing: '0',
        currentUserId: user?.id,
        currentUserName: user?.fullName || 'You',
      } as any,
    } as any);
  };

  const confirmRemove = (n: AppNotification) => {
    Alert.alert('Remove notification?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove(n.id) },
    ]);
  };

  const renderRight = (n: AppNotification) => {
    if (n.type === 'follow' && n.actorId) {
      const isF = following.has(n.actorId);
      return (
        <TouchableOpacity
          onPress={() => toggleFollow(n.actorId as string)}
          disabled={followBusy === n.actorId}
          style={[styles.followBtn, isF ? { backgroundColor: colors.backgroundTertiary } : { backgroundColor: colors.accent }]}
          activeOpacity={0.8}
        >
          {followBusy === n.actorId ? (
            <ActivityIndicator size="small" color={isF ? colors.text : '#FFF'} />
          ) : (
            <Text style={[styles.followBtnText, { color: isF ? colors.text : '#FFF' }]}>{isF ? 'Following' : 'Follow back'}</Text>
          )}
        </TouchableOpacity>
      );
    }
    if (n.type === 'call_request') {
      return (
        <View style={styles.actionPair}>
          <TouchableOpacity style={[styles.roundAction, { backgroundColor: '#22C55E' }]} onPress={() => answerCall(n)}>
            <Phone size={16} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.roundAction, { backgroundColor: colors.backgroundTertiary }]} onPress={() => remove(n.id)}>
            <X size={16} color={colors.text} />
          </TouchableOpacity>
        </View>
      );
    }
    if (n.type === 'room_invite') {
      return (
        <View style={styles.actionPair}>
          <TouchableOpacity style={[styles.smallPill, { backgroundColor: colors.accent }]} onPress={() => openNotification(n)}>
            <Text style={styles.smallPillText}>Join</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.roundAction, { backgroundColor: colors.backgroundTertiary }]} onPress={() => remove(n.id)}>
            <X size={16} color={colors.text} />
          </TouchableOpacity>
        </View>
      );
    }
    const thumb = thumbnailFor(n);
    if (thumb) {
      return (
        <TouchableOpacity onPress={() => (n.data?.post_image_url ? router.push('/(tabs)/profile' as any) : openNotification(n))} activeOpacity={0.85}>
          <Image source={{ uri: thumb }} style={[styles.thumb, { backgroundColor: colors.backgroundTertiary }]} />
        </TouchableOpacity>
      );
    }
    return null;
  };

  const renderItem = ({ item: n }: { item: AppNotification }) => (
    <TouchableOpacity
      style={[styles.row, !n.read && { backgroundColor: isDark ? 'rgba(0,149,246,0.08)' : 'rgba(0,149,246,0.05)' }]}
      onPress={() => openNotification(n)}
      onLongPress={() => confirmRemove(n)}
      delayLongPress={400}
      activeOpacity={0.7}
      testID={`notification-${n.id}`}
    >
      <TouchableOpacity onPress={() => n.actorId && router.push(`/user/${n.actorId}` as any)} activeOpacity={0.8}>
        <Avatar uri={n.actorAvatar} bg={colors.backgroundTertiary} iconColor={colors.textTertiary} />
        {n.type === 'like' && (
          <View style={[styles.typeBadge, { borderColor: colors.background, backgroundColor: '#FF3040' }]}>
            <Heart size={9} color="#FFF" fill="#FFF" />
          </View>
        )}
        {n.type === 'room_invite' && (
          <View style={[styles.typeBadge, { borderColor: colors.background, backgroundColor: colors.accent }]}>
            <Video size={9} color="#FFF" />
          </View>
        )}
      </TouchableOpacity>
      <Text style={[styles.rowText, { color: colors.text }]} numberOfLines={3}>
        <Text style={styles.bold}>{n.actorName}</Text> {describe(n)}{' '}
        <Text style={{ color: colors.textTertiary }}>{shortAgo(n.createdAt)}</Text>
      </Text>
      {renderRight(n)}
    </TouchableOpacity>
  );

  // ── Connection requests sub-view (like Instagram's "Follow requests") ──
  const incoming = connections.incomingRequests;
  const approve = async (r: ConnectionRequest) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try { await connections.approveRequest(r.id); } catch { Alert.alert('Error', 'Could not accept the request.'); }
  };
  const reject = async (r: ConnectionRequest) => {
    try { await connections.rejectRequest(r.id); } catch { Alert.alert('Error', 'Could not remove the request.'); }
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 6, borderBottomColor: colors.borderLight ?? colors.border }]}>
      <TouchableOpacity
        onPress={() => (showRequests ? setShowRequests(false) : router.back())}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.headerBack}
      >
        <ChevronLeft size={30} color={colors.text} strokeWidth={2.2} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: colors.text }]}>{showRequests ? 'Connection requests' : 'Notifications'}</Text>
      <View style={styles.headerBack} />
    </View>
  );

  if (showRequests) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        {incoming.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No requests</Text>
          </View>
        ) : (
          incoming.map((r) => (
            <View key={r.id} style={styles.row}>
              <TouchableOpacity onPress={() => router.push(`/user/${r.fromUserId}` as any)}>
                <Avatar uri={r.fromProfile.avatar} bg={colors.backgroundTertiary} iconColor={colors.textTertiary} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={[styles.bold, { color: colors.text, fontSize: 14 }]} numberOfLines={1}>{r.fromProfile.username || r.fromProfile.name}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={1}>{r.fromProfile.name}</Text>
              </View>
              <TouchableOpacity style={[styles.followBtn, { backgroundColor: colors.accent }]} onPress={() => approve(r)}>
                <Text style={[styles.followBtnText, { color: '#FFF' }]}>Confirm</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.followBtn, { backgroundColor: colors.backgroundTertiary, marginLeft: 6 }]} onPress={() => reject(r)}>
                <Text style={[styles.followBtnText, { color: colors.text }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {header}
      <SectionList
        sections={sections}
        keyExtractor={(n) => n.id}
        renderItem={renderItem}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />}
        ListHeaderComponent={
          incoming.length > 0 ? (
            <TouchableOpacity style={styles.row} onPress={() => setShowRequests(true)} activeOpacity={0.7}>
              <View style={[styles.requestsIcon, { borderColor: colors.border }]}>
                <UserPlus size={20} color={colors.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.bold, { color: colors.text, fontSize: 14 }]}>Connection requests</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={1}>
                  {incoming[0].fromProfile.username || incoming[0].fromProfile.name}
                  {incoming.length > 1 ? ` + ${incoming.length - 1} other${incoming.length > 2 ? 's' : ''}` : ''}
                </Text>
              </View>
              <View style={styles.reqCountDot}><Text style={styles.reqCountText}>{incoming.length}</Text></View>
              <ChevronRight size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : undefined
        }
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
        )}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.empty}><ActivityIndicator color={colors.textSecondary} /></View>
          ) : (
            <View style={styles.empty}>
              <View style={[styles.emptyCircle, { borderColor: colors.text }]}>
                <Heart size={40} color={colors.text} strokeWidth={1.5} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Activity on your posts</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                When someone likes, comments, follows you or grabs your bundle, you&apos;ll see it here.
              </Text>
            </View>
          )
        }
      />
      {notifications.some((n) => !n.read) && (
        <TouchableOpacity
          style={[styles.markAll, { backgroundColor: colors.surface, borderColor: colors.border, bottom: insets.bottom + 16 }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); markAllRead(); }}
          activeOpacity={0.85}
        >
          <Check size={15} color={colors.text} />
          <Text style={[styles.markAllText, { color: colors.text }]}>Mark all as read</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 6, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBack: { width: 44, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '700', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 9, gap: 12 },
  rowText: { flex: 1, fontSize: 14, lineHeight: 19 },
  bold: { fontWeight: '700' },
  thumb: { width: 44, height: 44, borderRadius: 4 },
  followBtn: { paddingHorizontal: 16, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minWidth: 92 },
  followBtnText: { fontSize: 14, fontWeight: '600' },
  actionPair: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roundAction: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  smallPill: { paddingHorizontal: 14, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  smallPillText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  typeBadge: {
    position: 'absolute', right: -2, bottom: -2, width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
  },
  requestsIcon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  reqCountDot: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#FF3040', paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  reqCountText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingTop: 80, gap: 10 },
  emptyCircle: { width: 92, height: 92, borderRadius: 46, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  markAll: {
    position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, height: 38, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  markAllText: { fontSize: 13, fontWeight: '600' },
});
