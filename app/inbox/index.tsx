import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Camera, ChevronLeft, MessageCircle, Search, SquarePen, X } from 'lucide-react-native';

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useMessaging, Conversation, Message } from '@/contexts/MessagingContext';
import { useConnections } from '@/contexts/ConnectionsContext';
import { supabase } from '@/lib/supabase';

type ProfileHit = { id: string; name: string; username: string; avatar: string };

function shortAgo(ts: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / 604800)}w`;
}

/** Instagram-style one-line summary of a message. */
function summarize(m: Message | undefined, myId: string): string {
  if (!m) return 'Say hi 👋';
  const mine = m.senderId === myId;
  const meta: any = m.metadata || {};
  let body = (m.text || m.content || '').trim();
  if (meta.image) body = mine ? 'You sent a photo' : 'Sent a photo';
  else if (meta.payment_request) body = mine ? `You requested $${(meta.payment_request.amount_cents / 100).toFixed(2).replace(/\.00$/, '')}` : `Requested $${(meta.payment_request.amount_cents / 100).toFixed(2).replace(/\.00$/, '')} · tap to pay`;
  else if (meta.voice_note) body = mine ? 'You sent a voice message' : 'Sent a voice message';
  else if (meta.bundle_card) body = mine ? `You grabbed "${meta.bundle_card.title}"` : `Grabbed your bundle "${meta.bundle_card.title}"`;
  else if (meta.skill_card) body = mine ? `You grabbed "${meta.skill_card.title}"` : `Grabbed your skill "${meta.skill_card.title}"`;
  else if (meta.request_card) body = mine ? `You offered help: "${meta.request_card.title}"` : `Can help with "${meta.request_card.title}"`;
  else if (m.sharedPost) body = mine ? 'You shared a post' : 'Shared a post';
  else if (mine) body = `You: ${body}`;
  return body;
}

function Avatar({ uri, size, bg, online, ring }: { uri?: string; size: number; bg: string; online?: boolean; ring: string }) {
  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg }} />
      ) : (
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg }} />
      )}
      {online && (
        <View
          style={{
            position: 'absolute', right: 0, bottom: 0,
            width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14,
            backgroundColor: '#22C55E', borderWidth: 3, borderColor: ring,
          }}
        />
      )}
    </View>
  );
}

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const messaging = useMessaging();
  const connections = useConnections();
  const myId = user?.id || '';

  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [peopleHits, setPeopleHits] = useState<ProfileHit[]>([]);
  const [searchingPeople, setSearchingPeople] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeQuery, setComposeQuery] = useState('');
  const [composeHits, setComposeHits] = useState<ProfileHit[]>([]);

  const { conversations, presence } = messaging;
  const requestCount = connections.incomingRequests.length;

  const sorted = useMemo(
    () => [...conversations].sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()),
    [conversations],
  );

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? sorted.filter((c) => c.participantName.toLowerCase().includes(q) || c.participantUsername.toLowerCase().includes(q)) : sorted),
    [sorted, q],
  );

  // People row: who's active now first, then recent chats.
  const peopleRow = useMemo(() => {
    const online = sorted.filter((c) => presence[c.participantId]?.online);
    const rest = sorted.filter((c) => !presence[c.participantId]?.online);
    return [...online, ...rest].slice(0, 12);
  }, [sorted, presence]);

  // Search people in the app (not just existing chats) — debounced.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchProfiles = useCallback(async (text: string, setter: (h: ProfileHit[]) => void, setBusy?: (b: boolean) => void) => {
    const t = text.trim().replace(/[%,()]/g, '');
    if (t.length < 2) { setter([]); return; }
    setBusy?.(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar')
      .or(`full_name.ilike.%${t}%,username.ilike.%${t}%`)
      .neq('id', myId)
      .limit(15);
    setter((data || []).map((p: any) => ({ id: p.id, name: p.full_name || p.username || 'User', username: p.username || '', avatar: p.avatar || '' })));
    setBusy?.(false);
  }, [myId]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchProfiles(query, setPeopleHits, setSearchingPeople), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query, searchProfiles]);

  useEffect(() => {
    const t = setTimeout(() => searchProfiles(composeQuery, setComposeHits), 250);
    return () => clearTimeout(t);
  }, [composeQuery, searchProfiles]);

  const openChat = (participantId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setComposeOpen(false);
    router.push(`/inbox/conversation/${participantId}` as any);
  };

  const confirmDelete = (c: Conversation) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(c.participantName, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete chat', style: 'destructive', onPress: () => messaging.deleteConversation(c.participantId) },
    ]);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 600));
    setRefreshing(false);
  }, []);

  const renderRow = ({ item: c }: { item: Conversation }) => {
    const last = c.messages[c.messages.length - 1];
    const unread = (c.unreadCount || 0) > 0;
    const p = presence[c.participantId];
    let subtitle = summarize(last, myId);
    if (p?.typing) subtitle = 'Typing…';
    else if (unread && c.unreadCount > 1) subtitle = `${c.unreadCount > 4 ? '4+' : c.unreadCount} new messages`;
    else if (last && last.senderId === myId && last.read) subtitle = 'Seen';
    else if (!last && p?.online) subtitle = 'Active now';
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => openChat(c.participantId)}
        onLongPress={() => confirmDelete(c)}
        delayLongPress={450}
        activeOpacity={0.6}
        testID={`thread-${c.participantId}`}
      >
        <Avatar uri={c.participantAvatar} size={56} bg={colors.backgroundTertiary} online={p?.online} ring={colors.background} />
        <View style={styles.rowBody}>
          <Text style={[styles.rowName, { color: colors.text, fontWeight: unread ? '700' : '400' }]} numberOfLines={1}>
            {c.participantName}
          </Text>
          <View style={styles.rowSubLine}>
            <Text
              style={[styles.rowSub, { color: unread || p?.typing ? colors.text : colors.textSecondary, fontWeight: unread ? '600' : '400', flexShrink: 1 }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
            {last && !p?.typing && (
              <Text style={[styles.rowSub, { color: colors.textSecondary, flexShrink: 0 }]} numberOfLines={1}>{"\u00A0· "}{shortAgo(last.timestamp)}</Text>
            )}
          </View>
        </View>
        {unread ? (
          <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />
        ) : (
          <TouchableOpacity onPress={() => openChat(c.participantId)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Camera size={24} color={colors.textSecondary} strokeWidth={1.8} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const listHeader = (
    <View>
      {/* Search */}
      <View style={[styles.search, { backgroundColor: colors.backgroundTertiary }]}>
        <Search size={17} color={colors.textTertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search"
          placeholderTextColor={colors.textTertiary}
          style={[styles.searchInput, { color: colors.text }]}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          testID="inbox-search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Active / recent people */}
      {!q && peopleRow.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleRow}>
          {peopleRow.map((c) => (
            <TouchableOpacity key={c.id} style={styles.person} onPress={() => openChat(c.participantId)} activeOpacity={0.7}>
              <Avatar uri={c.participantAvatar} size={70} bg={colors.backgroundTertiary} online={presence[c.participantId]?.online} ring={colors.background} />
              <Text style={[styles.personName, { color: colors.textSecondary }]} numberOfLines={1}>
                {c.participantName.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Section title */}
      <View style={styles.sectionRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Messages</Text>
        <TouchableOpacity onPress={() => router.push('/notifications?requests=1' as any)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.requestsLink, { color: requestCount ? colors.accent : colors.textSecondary }]}>
            Requests{requestCount ? ` (${requestCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const newPeople = q ? peopleHits.filter((p) => !conversations.some((c) => c.participantId === p.id)) : [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.headerSide}>
          <ChevronLeft size={30} color={colors.text} strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {user?.username || user?.fullName || 'Messages'}
        </Text>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setComposeOpen(true); }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={[styles.headerSide, { alignItems: 'flex-end' }]}
          accessibilityLabel="New message"
          testID="inbox-new-message"
        >
          <SquarePen size={24} color={colors.text} strokeWidth={1.9} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        renderItem={renderRow}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />}
        ListFooterComponent={
          q ? (
            <View>
              {(searchingPeople || newPeople.length > 0) && (
                <Text style={[styles.sectionTitle, { color: colors.text, paddingHorizontal: 16, marginTop: 16, marginBottom: 6 }]}>More people</Text>
              )}
              {searchingPeople && <ActivityIndicator style={{ marginTop: 8 }} color={colors.textSecondary} />}
              {newPeople.map((p) => (
                <TouchableOpacity key={p.id} style={styles.row} onPress={() => openChat(p.id)} activeOpacity={0.6}>
                  <Avatar uri={p.avatar} size={56} bg={colors.backgroundTertiary} ring={colors.background} />
                  <View style={styles.rowBody}>
                    <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
                    {!!p.username && <Text style={[styles.rowSub, { color: colors.textSecondary }]} numberOfLines={1}>{p.username}</Text>}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          q ? undefined : (
            <View style={styles.empty}>
              <View style={[styles.emptyCircle, { borderColor: colors.text }]}>
                <MessageCircle size={42} color={colors.text} strokeWidth={1.5} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Your messages</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Send private photos, voice notes and messages to a friend.</Text>
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={() => setComposeOpen(true)}>
                <Text style={styles.primaryBtnText}>Send message</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />

      {/* New message */}
      <Modal visible={composeOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setComposeOpen(false)}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { paddingTop: 14 }]}>
            <TouchableOpacity onPress={() => setComposeOpen(false)} style={styles.headerSide} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <X size={26} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>New message</Text>
            <View style={styles.headerSide} />
          </View>
          <View style={[styles.toRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.toLabel, { color: colors.text }]}>To:</Text>
            <TextInput
              value={composeQuery}
              onChangeText={setComposeQuery}
              placeholder="Search..."
              placeholderTextColor={colors.textTertiary}
              style={[styles.searchInput, { color: colors.text }]}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
          <FlatList
            data={composeQuery.trim().length >= 2 ? composeHits : sorted.map((c) => ({ id: c.participantId, name: c.participantName, username: c.participantUsername, avatar: c.participantAvatar }))}
            keyExtractor={(p) => p.id}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <Text style={[styles.sectionTitle, { color: colors.text, paddingHorizontal: 16, marginTop: 12, marginBottom: 4 }]}>
                {composeQuery.trim().length >= 2 ? 'Results' : 'Suggested'}
              </Text>
            }
            renderItem={({ item: p }) => (
              <TouchableOpacity style={styles.row} onPress={() => openChat(p.id)} activeOpacity={0.6}>
                <Avatar uri={p.avatar} size={48} bg={colors.backgroundTertiary} online={presence[p.id]?.online} ring={colors.background} />
                <View style={styles.rowBody}>
                  <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
                  {!!p.username && <Text style={[styles.rowSub, { color: colors.textSecondary }]} numberOfLines={1}>{p.username}</Text>}
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={[styles.emptySub, { color: colors.textSecondary, marginTop: 30 }]}>
                {composeQuery.trim().length >= 2 ? 'No account found.' : 'Search for someone to message.'}
              </Text>
            }
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingBottom: 8 },
  headerSide: { width: 44, justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', flex: 1, textAlign: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 4, paddingHorizontal: 12, height: 38, borderRadius: 12 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  peopleRow: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 6, gap: 6 },
  person: { width: 80, alignItems: 'center', gap: 6 },
  personName: { fontSize: 12, maxWidth: 76 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  requestsLink: { fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
  rowBody: { flex: 1, justifyContent: 'center' },
  rowName: { fontSize: 15 },
  rowSubLine: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  rowSub: { fontSize: 14 },
  unreadDot: { width: 9, height: 9, borderRadius: 5 },
  empty: { alignItems: 'center', paddingHorizontal: 40, paddingTop: 70, gap: 10 },
  emptyCircle: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  primaryBtn: { marginTop: 10, paddingHorizontal: 20, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#FFF', fontWeight: '600', fontSize: 15 },
  toRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  toLabel: { fontSize: 16, fontWeight: '600' },
});
