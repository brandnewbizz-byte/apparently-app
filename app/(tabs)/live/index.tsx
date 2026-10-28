import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Image,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, Plus, Lock, Globe, X, Sparkles, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  answerInvite, createRoom, deleteRoom, getRooms, listInvites, listRooms, themeFor, SPOT_THEMES,
  type SpotInvite, type SpotRoom,
} from '@/lib/spot';

const tap = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function RoomCard({ room, mine, onOpen, onLongPress, colors }: { room: SpotRoom; mine: boolean; onOpen: () => void; onLongPress?: () => void; colors: any }) {
  const t = themeFor(room.theme);
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onOpen} onLongPress={onLongPress} style={styles.card} accessibilityLabel={`Open ${room.name}`}>
      <LinearGradient colors={t.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardArt}>
        <Text style={styles.cardEmoji}>{t.emoji}</Text>
        {room.visibility !== 'public' ? (
          <View style={styles.lock}><Lock size={11} color="#FFF" /></View>
        ) : null}
      </LinearGradient>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{room.name}</Text>
        <View style={styles.cardMeta}>
          {room.creatorAvatar ? <Image source={{ uri: room.creatorAvatar }} style={styles.metaAvatar} /> : null}
          <Text style={[styles.cardSub, { color: colors.textSecondary }]} numberOfLines={1}>
            {mine ? 'Your room' : room.creatorName} · {ago(room.updatedAt)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function SpotLobby() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();

  const [rooms, setRooms] = useState<SpotRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [theme, setTheme] = useState(SPOT_THEMES[0].id);
  const [privateRoom, setPrivateRoom] = useState(false);

  const [invites, setInvites] = useState<SpotInvite[]>([]);
  const [joined, setJoined] = useState<SpotRoom[]>([]);
  const [answering, setAnswering] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, inv] = await Promise.all([listRooms(user?.id), user?.id ? listInvites(user.id).catch(() => []) : Promise.resolve([])]);
      setRooms(list);
      setInvites(inv);
      const acceptedIds = inv.filter((i) => i.status === 'accepted').map((i) => i.roomId);
      setJoined(acceptedIds.length ? (await getRooms(acceptedIds)).filter((r) => r.creatorId !== user?.id) : []);
    } catch { /* keep list */ } finally { setLoading(false); }
  }, [user?.id]);

  const respond = async (inv: SpotInvite, accept: boolean) => {
    if (!user?.id || answering) return;
    tap();
    setAnswering(inv.id);
    try {
      await answerInvite(inv.id, accept, { id: user.id, name: user.fullName || user.username || 'Someone', avatar: user.avatar || null });
      setInvites((prev) => prev.map((i) => (i.id === inv.id ? { ...i, status: accept ? 'accepted' : 'declined' } : i)));
      if (accept) router.push(`/(tabs)/live/room/${inv.roomId}` as any);
    } catch {
      Alert.alert('Something went wrong', 'Please try again.');
    } finally {
      setAnswering(null);
    }
  };
  const pending = invites.filter((i) => i.status === 'pending');

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const mine = rooms.filter((r) => r.creatorId === user?.id);
  const joinedIds = new Set(joined.map((r) => r.id));
  const open = rooms.filter((r) => r.creatorId !== user?.id && !joinedIds.has(r.id));

  const openRoom = (id: string) => { tap(); router.push(`/(tabs)/live/room/${id}` as any); };

  const make = async () => {
    if (!user?.id || creating) return;
    setCreating(true);
    try {
      const room = await createRoom({
        name: name.trim() || 'Hangout',
        theme,
        visibility: privateRoom ? 'invite_only' : 'public',
        me: { id: user.id, name: user.fullName || user.username || 'Someone', avatar: user.avatar || null },
      });
      setShowNew(false);
      setName('');
      setRooms((prev) => [room, ...prev]);
      openRoom(room.id);
    } catch {
      Alert.alert('Room not created', 'Check your connection and try again.');
    } finally {
      setCreating(false);
    }
  };

  const manage = (room: SpotRoom) => {
    tap();
    Alert.alert(room.name, undefined, [
      {
        text: 'Delete room', style: 'destructive',
        onPress: async () => {
          const prev = rooms;
          setRooms((r) => r.filter((x) => x.id !== room.id));
          try { await deleteRoom(room.id); } catch { setRooms(prev); Alert.alert('Not deleted', 'Please try again.'); }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.textTertiary} />}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={['#5B2A86', '#8B5CF6', '#EC4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.navigate('/(tabs)/planner' as any))} style={styles.back} accessibilityLabel="Back">
            <ChevronLeft size={26} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>Spot</Text>
          <Text style={styles.heroSub}>Virtual rooms to hang out and plan with friends — live.{'\n'}Drop things in, doodle, move stuff around, react.</Text>
          <TouchableOpacity style={styles.newBtn} onPress={() => { tap(); setShowNew(true); }} accessibilityLabel="New room">
            <Plus size={20} color="#5B2A86" strokeWidth={2.6} />
            <Text style={styles.newText}>New room</Text>
          </TouchableOpacity>
        </LinearGradient>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.textTertiary} />
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {pending.length ? (
              <>
                <Text style={[styles.section, { color: colors.text }]}>Invites</Text>
                {pending.map((inv) => {
                  const t = themeFor(inv.theme);
                  return (
                    <View key={inv.id} style={[styles.invite, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <LinearGradient colors={t.colors} style={styles.inviteArt}><Text style={{ fontSize: 20 }}>{t.emoji}</Text></LinearGradient>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{inv.roomName}</Text>
                        <Text style={[styles.cardSub, { color: colors.textSecondary }]} numberOfLines={1}>{inv.fromName} invited you · {ago(inv.createdAt)}</Text>
                      </View>
                      <TouchableOpacity onPress={() => respond(inv, false)} disabled={!!answering} style={[styles.inviteBtn, { backgroundColor: colors.surfaceHighlight }]} accessibilityLabel={`Decline ${inv.roomName}`}>
                        <X size={16} color={colors.text} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => respond(inv, true)} disabled={!!answering} style={[styles.inviteBtn, { backgroundColor: '#8B5CF6' }]} accessibilityLabel={`Accept ${inv.roomName}`}>
                        {answering === inv.id ? <ActivityIndicator size="small" color="#FFF" /> : <Check size={16} color="#FFF" strokeWidth={3} />}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </>
            ) : null}

            <Text style={[styles.section, { color: colors.text }]}>Your rooms</Text>
            {mine.length === 0 ? (
              <TouchableOpacity style={[styles.empty, { borderColor: colors.border }]} onPress={() => setShowNew(true)}>
                <Sparkles size={22} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Make your first room and invite friends in.</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.grid}>
                {mine.map((r) => <RoomCard key={r.id} room={r} mine colors={colors} onOpen={() => openRoom(r.id)} onLongPress={() => manage(r)} />)}
              </View>
            )}

            {joined.length ? (
              <>
                <Text style={[styles.section, { color: colors.text }]}>{"Rooms you're in"}</Text>
                <View style={styles.grid}>
                  {joined.map((r) => <RoomCard key={r.id} room={r} mine={false} colors={colors} onOpen={() => openRoom(r.id)} />)}
                </View>
              </>
            ) : null}

            {open.length ? (
              <>
                <Text style={[styles.section, { color: colors.text }]}>Open rooms</Text>
                <View style={styles.grid}>
                  {open.map((r) => <RoomCard key={r.id} room={r} mine={false} colors={colors} onOpen={() => openRoom(r.id)} />)}
                </View>
              </>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* New room */}
      <Modal visible={showNew} transparent animationType="slide" onRequestClose={() => setShowNew(false)} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={() => setShowNew(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.anchor} pointerEvents="box-none">
          <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHead}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>New room</Text>
              <TouchableOpacity onPress={() => setShowNew(false)} hitSlop={10}><X size={22} color={colors.text} /></TouchableOpacity>
            </View>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Name it — e.g. Miami trip, Friday plans"
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              maxLength={40}
              autoFocus
              returnKeyType="done"
            />
            <Text style={[styles.label, { color: colors.textSecondary }]}>Vibe</Text>
            <View style={styles.themes}>
              {SPOT_THEMES.map((t) => (
                <TouchableOpacity key={t.id} onPress={() => setTheme(t.id)} style={styles.themeCell} accessibilityLabel={`${t.name} theme`} accessibilityState={{ selected: theme === t.id }}>
                  <LinearGradient colors={t.colors} style={[styles.themeSwatch, theme === t.id && { borderColor: colors.text }]}>
                    <Text style={{ fontSize: 20 }}>{t.emoji}</Text>
                  </LinearGradient>
                  <Text style={[styles.themeName, { color: colors.textSecondary }]}>{t.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[styles.toggle, { backgroundColor: colors.surfaceHighlight }]}>
              {[
                { v: false, label: 'Anyone', icon: Globe },
                { v: true, label: 'Invite only', icon: Lock },
              ].map((o) => {
                const on = privateRoom === o.v;
                const Icon = o.icon;
                return (
                  <TouchableOpacity key={o.label} onPress={() => setPrivateRoom(o.v)} style={[styles.toggleBtn, on && { backgroundColor: colors.background }]}>
                    <Icon size={15} color={on ? colors.text : colors.textSecondary} />
                    <Text style={[styles.toggleText, { color: on ? colors.text : colors.textSecondary }]}>{o.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={[styles.create, creating && { opacity: 0.6 }]} onPress={make} disabled={creating}>
              {creating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.createText}>Create & open</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  invite: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, padding: 10, marginBottom: 8 },
  inviteArt: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  inviteBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1 },
  hero: { paddingHorizontal: 20, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  back: { width: 40, height: 40, marginLeft: -8, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#FFF', fontSize: 34, fontWeight: '900', letterSpacing: -0.8, marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.88)', fontSize: 15, lineHeight: 21, marginTop: 6 },
  newBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, backgroundColor: '#FFF', borderRadius: 22, paddingHorizontal: 18, height: 44, marginTop: 18 },
  newText: { color: '#5B2A86', fontSize: 15, fontWeight: '800' },
  section: { fontSize: 18, fontWeight: '800', marginTop: 24, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '48%', flexGrow: 0 },
  cardArt: { height: 110, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cardEmoji: { fontSize: 40 },
  lock: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 10, padding: 4 },
  cardBody: { paddingTop: 8, paddingHorizontal: 2 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  metaAvatar: { width: 16, height: 16, borderRadius: 8 },
  cardSub: { fontSize: 12, flexShrink: 1 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 18, padding: 20, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 14, textAlign: 'center' },

  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 16, gap: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 20, fontWeight: '900' },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 50, fontSize: 16 },
  label: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  themes: { flexDirection: 'row', justifyContent: 'space-between' },
  themeCell: { alignItems: 'center', gap: 4 },
  themeSwatch: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'transparent' },
  themeName: { fontSize: 11, fontWeight: '700' },
  toggle: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 10 },
  toggleText: { fontSize: 14, fontWeight: '700' },
  create: { backgroundColor: '#8B5CF6', height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  createText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
