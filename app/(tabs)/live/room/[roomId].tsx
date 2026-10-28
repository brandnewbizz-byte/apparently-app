import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, PanResponder, Platform, Share, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, Hand, PenLine, Plus, Smile, Undo2, UserPlus, Palette } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTabBar } from '@/contexts/TabBarContext';
import { useSpotRoom } from '@/hooks/useSpotRoom';
import {
  getRoom, themeFor, touchRoom, updateRoom, roomLink, PEN_COLORS, REACTIONS, SPOT_THEMES,
  type SpotPoint, type SpotRoom,
} from '@/lib/spot';
import { uploadImageToStorage } from '@/lib/storage';
import DoodleLayer from '@/components/spot/DoodleLayer';
import BurstLayer from '@/components/spot/BurstLayer';
import SpotItemView from '@/components/spot/SpotItemView';
import { AddSheet, ItemMenu } from '@/components/spot/SpotSheets';

type Mode = 'move' | 'draw';
const PEN_WIDTHS = [3, 6, 12];

const tap = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
  if (Platform.OS !== 'web') Haptics.impactAsync(style);
};
const nearCenter = () => 0.35 + Math.random() * 0.3;

export default function SpotRoomScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { hideTabBar, showTabBar } = useTabBar();

  const me = useMemo(() => (user?.id ? { id: user.id, name: user.fullName || user.username || 'You', avatar: user.avatar || '' } : null), [user?.id, user?.fullName, user?.username, user?.avatar]);
  const room = useSpotRoom(roomId, me);

  const [info, setInfo] = useState<SpotRoom | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('move');
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [penWidth, setPenWidth] = useState(PEN_WIDTHS[1]);
  const [showAdd, setShowAdd] = useState(false);
  const [showReact, setShowReact] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [myStroke, setMyStroke] = useState<SpotPoint[]>([]);

  // Full-screen room: hide the tab bar while inside.
  useEffect(() => { hideTabBar(); return () => showTabBar(); }, [hideTabBar, showTabBar]);

  useEffect(() => {
    if (!roomId) return;
    getRoom(roomId).then((r) => {
      setInfo(r);
      if (r && me) touchRoom(r, me.id);
    }).finally(() => setInfoLoading(false));
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  const theme = themeFor(info?.theme);
  const isHost = !!me && info?.creatorId === me.id;
  const things = room.items.filter((i) => i.kind !== 'doodle');
  const doodles = room.items.filter((i) => i.kind === 'doodle');
  const myDoodles = doodles.filter((d) => d.ownerId === me?.id);
  const menuItem = menuId ? room.items.find((i) => i.id === menuId) || null : null;

  // ── Drawing ───────────────────────────────────────────────────────────────
  const drawRef = useRef({ mode, size, penColor, penWidth, points: [] as SpotPoint[] });
  drawRef.current.mode = mode;
  drawRef.current.size = size;
  drawRef.current.penColor = penColor;
  drawRef.current.penWidth = penWidth;
  const strokeFns = useRef({ progress: room.strokeProgress, done: room.strokeDone });
  strokeFns.current = { progress: room.strokeProgress, done: room.strokeDone };

  const canvasPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => drawRef.current.mode === 'draw',
    onMoveShouldSetPanResponder: () => drawRef.current.mode === 'draw',
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      const { w, h } = drawRef.current.size;
      const { locationX, locationY } = e.nativeEvent;
      drawRef.current.points = [{ x: locationX / w, y: locationY / h }];
      setMyStroke(drawRef.current.points);
    },
    onPanResponderMove: (e) => {
      const { w, h } = drawRef.current.size;
      const { locationX, locationY } = e.nativeEvent;
      const p = { x: Math.min(1, Math.max(0, locationX / w)), y: Math.min(1, Math.max(0, locationY / h)) };
      const pts = drawRef.current.points;
      const last = pts[pts.length - 1];
      if (last && Math.hypot((p.x - last.x) * w, (p.y - last.y) * h) < 3) return;
      const next = [...pts, p];
      drawRef.current.points = next;
      setMyStroke(next);
      strokeFns.current.progress(next, drawRef.current.penColor, drawRef.current.penWidth);
    },
    onPanResponderRelease: () => {
      const pts = drawRef.current.points;
      drawRef.current.points = [];
      // Keep showing it until the saved version arrives.
      strokeFns.current.done(pts, drawRef.current.penColor, drawRef.current.penWidth).finally(() => setMyStroke([]));
    },
    onPanResponderTerminate: () => {
      const pts = drawRef.current.points;
      drawRef.current.points = [];
      strokeFns.current.done(pts, drawRef.current.penColor, drawRef.current.penWidth).finally(() => setMyStroke([]));
    },
  }), []);

  const liveStrokes = useMemo(() => {
    const list = Object.values(room.liveStrokes);
    if (myStroke.length) list.push({ points: myStroke, color: penColor, width: penWidth });
    return list;
  }, [room.liveStrokes, myStroke, penColor, penWidth]);

  const undoDoodle = () => {
    const last = [...myDoodles].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')).pop();
    if (last) { tap(); room.remove(last.id); }
  };

  // ── Adding things ─────────────────────────────────────────────────────────
  const addSticker = async (emoji: string) => {
    setShowAdd(false);
    tap(Haptics.ImpactFeedbackStyle.Medium);
    setMode('move');
    const it = await room.add({ kind: 'sticker', emoji, x: nearCenter(), y: nearCenter() });
    if (!it) Alert.alert('Not added', 'Check your connection and try again.');
  };
  const addNote = async (text: string, color: string) => {
    setShowAdd(false);
    tap(Haptics.ImpactFeedbackStyle.Medium);
    setMode('move');
    const it = await room.add({ kind: 'note', text, color, x: nearCenter(), y: nearCenter() });
    if (!it) Alert.alert('Not added', 'Check your connection and try again.');
  };
  const addPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Photos access needed', 'Allow photo access in Settings to pin a photo.'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (r.canceled || !r.assets?.[0]) return;
    setUploading(true);
    try {
      const url = await uploadImageToStorage(r.assets[0].uri, 'room-files', `spot/${roomId}`);
      if (!url || url.startsWith('file:')) throw new Error('upload failed');
      setShowAdd(false);
      setMode('move');
      const it = await room.add({ kind: 'photo', imageUrl: url, x: nearCenter(), y: nearCenter() });
      if (!it) throw new Error('save failed');
    } catch {
      Alert.alert('Photo not added', 'Check your connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  // ── Item gestures ─────────────────────────────────────────────────────────
  const onTap = useCallback((id: string) => setSelectedId(id), []);
  const onDoubleTap = useCallback((id: string) => { tap(); room.react(id, '❤️'); }, [room]);
  const onLongPress = useCallback((id: string) => { tap(Haptics.ImpactFeedbackStyle.Medium); setSelectedId(id); setMenuId(id); }, []);
  const onDrag = useCallback((id: string, x: number, y: number, z: number) => { setSelectedId(id); room.dragTo(id, x, y, z); }, [room]);
  const onDrop = useCallback((id: string, x: number, y: number, z: number) => { room.dropAt(id, x, y, z); }, [room]);

  const invite = () => {
    tap();
    Share.share({ message: `Come hang out in my room "${info?.name || 'Spot'}" on Apparently 🎈\n${roomLink(roomId || '')}` }).catch(() => {});
  };

  const changeTheme = async (id: string) => {
    if (!info) return;
    setShowThemes(false);
    const prev = info;
    setInfo({ ...info, theme: id });
    try { await updateRoom(info.id, { theme: id }); } catch { setInfo(prev); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const fg = theme.dark ? '#FFF' : '#111827';
  const glass = theme.dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.75)';

  if (!infoLoading && !info) {
    return (
      <View style={[styles.center, { backgroundColor: '#0B1026' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '800' }}>This room is gone</Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>It may have been deleted by its host.</Text>
        <TouchableOpacity onPress={() => router.back()} style={[styles.pill, { marginTop: 18, backgroundColor: '#FFF' }]}>
          <Text style={{ fontWeight: '800', color: '#111' }}>Back to Spot</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors[0] }}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={theme.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      {/* ── Canvas ── */}
      <View
        style={StyleSheet.absoluteFill}
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        {...canvasPan.panHandlers}
      >
        <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={() => setSelectedId(null)} disabled={mode === 'draw'} />
        <DoodleLayer width={size.w} height={size.h} ink={theme.ink} doodles={doodles} live={liveStrokes} />
        {size.w > 0 ? things.map((it) => (
          <SpotItemView
            key={it.id}
            item={it}
            live={room.remoteDrag[it.id]}
            canvasW={size.w}
            canvasH={size.h}
            enabled={mode === 'move'}
            topZ={room.topZ}
            myId={me?.id || ''}
            selected={selectedId === it.id}
            onDrag={onDrag}
            onDrop={onDrop}
            onTap={onTap}
            onDoubleTap={onDoubleTap}
            onLongPress={onLongPress}
          />
        )) : null}
        <BurstLayer bursts={room.bursts} width={size.w} height={size.h} />
      </View>

      {/* Empty-room hint */}
      {!room.loading && room.items.length === 0 ? (
        <View pointerEvents="none" style={styles.hintWrap}>
          <View style={[styles.hint, { backgroundColor: glass }]}>
            <Text style={[styles.hintTitle, { color: fg }]}>Your room is empty ✨</Text>
            <Text style={[styles.hintText, { color: fg }]}>Tap + to drop in stickers, notes or photos.{'\n'}Tap ✏️ to doodle. Everyone here sees it live.</Text>
          </View>
        </View>
      ) : null}
      {room.loading || infoLoading ? (
        <View pointerEvents="none" style={styles.hintWrap}><ActivityIndicator color={fg} /></View>
      ) : null}

      {/* ── Top bar ── */}
      <View style={[styles.top, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <TouchableOpacity onPress={() => router.back()} style={[styles.round, { backgroundColor: glass }]} accessibilityLabel="Leave room">
          <ChevronLeft size={24} color={fg} />
        </TouchableOpacity>
        <View style={[styles.titlePill, { backgroundColor: glass }]}>
          <Text style={[styles.title, { color: fg }]} numberOfLines={1}>{theme.emoji} {info?.name || 'Room'}</Text>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={[styles.liveText, { color: fg }]}>{room.members.length} here</Text>
          </View>
        </View>
        <View style={styles.avatars}>
          {room.members.slice(0, 4).map((m, i) => (
            m.avatar ? (
              <Image key={m.id} source={{ uri: m.avatar }} style={[styles.avatar, { marginLeft: i ? -10 : 0, borderColor: theme.colors[0] }]} />
            ) : (
              <View key={m.id} style={[styles.avatar, styles.avatarFallback, { marginLeft: i ? -10 : 0, borderColor: theme.colors[0] }]}>
                <Text style={styles.avatarInitial}>{(m.name || '?').charAt(0).toUpperCase()}</Text>
              </View>
            )
          ))}
        </View>
        {isHost ? (
          <TouchableOpacity onPress={() => setShowThemes((v) => !v)} style={[styles.round, { backgroundColor: glass }]} accessibilityLabel="Change room theme">
            <Palette size={19} color={fg} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={invite} style={[styles.round, { backgroundColor: glass }]} accessibilityLabel="Invite friends">
          <UserPlus size={19} color={fg} />
        </TouchableOpacity>
      </View>

      {showThemes ? (
        <View style={[styles.themes, { top: insets.top + 60 }]}>
          {SPOT_THEMES.map((t) => (
            <TouchableOpacity key={t.id} onPress={() => changeTheme(t.id)} style={styles.themeCell} accessibilityLabel={`${t.name} theme`}>
              <LinearGradient colors={t.colors} style={[styles.themeSwatch, info?.theme === t.id && styles.themeOn]}>
                <Text style={{ fontSize: 18 }}>{t.emoji}</Text>
              </LinearGradient>
              <Text style={styles.themeName}>{t.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {/* ── Draw options ── */}
      {mode === 'draw' ? (
        <View style={[styles.penBar, { bottom: insets.bottom + 92 }]}>
          {PEN_COLORS.map((c) => (
            <TouchableOpacity key={c} onPress={() => setPenColor(c)} style={[styles.penColor, { backgroundColor: c }, penColor === c && styles.penColorOn]} accessibilityLabel="Pen colour" />
          ))}
          <View style={styles.sep} />
          {PEN_WIDTHS.map((w) => (
            <TouchableOpacity key={w} onPress={() => setPenWidth(w)} style={[styles.penWidth, penWidth === w && styles.penWidthOn]} accessibilityLabel={`Pen size ${w}`}>
              <View style={{ width: w + 4, height: w + 4, borderRadius: (w + 4) / 2, backgroundColor: '#111' }} />
            </TouchableOpacity>
          ))}
          <View style={styles.sep} />
          <TouchableOpacity onPress={undoDoodle} disabled={!myDoodles.length} style={[styles.penWidth, !myDoodles.length && { opacity: 0.3 }]} accessibilityLabel="Undo my last doodle">
            <Undo2 size={18} color="#111" />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── Quick reactions ── */}
      {showReact ? (
        <View style={[styles.reactBar, { bottom: insets.bottom + 92 }]}>
          {REACTIONS.map((e) => (
            <TouchableOpacity key={e} onPress={() => { tap(); room.burst(e, 0.2 + Math.random() * 0.6); }} style={styles.reactBtn} accessibilityLabel={`Send ${e}`}>
              <Text style={{ fontSize: 28 }}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {/* ── Toolbar ── */}
      <View style={[styles.toolbar, { bottom: insets.bottom + 18 }]}>
        <TouchableOpacity
          onPress={() => { tap(); setMode('move'); setShowReact(false); }}
          style={[styles.tool, mode === 'move' && styles.toolOn]}
          accessibilityLabel="Move things"
          accessibilityState={{ selected: mode === 'move' }}
        >
          <Hand size={22} color={mode === 'move' ? '#FFF' : '#111'} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { tap(); setMode('draw'); setShowReact(false); setSelectedId(null); }}
          style={[styles.tool, mode === 'draw' && styles.toolOn]}
          accessibilityLabel="Doodle"
          accessibilityState={{ selected: mode === 'draw' }}
        >
          <PenLine size={22} color={mode === 'draw' ? '#FFF' : '#111'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { tap(); setShowAdd(true); setShowReact(false); }} style={styles.addBtn} accessibilityLabel="Add to the room">
          <Plus size={28} color="#FFF" strokeWidth={2.6} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { tap(); setShowReact((v) => !v); }}
          style={[styles.tool, showReact && styles.toolOn]}
          accessibilityLabel="Send a reaction"
        >
          <Smile size={22} color={showReact ? '#FFF' : '#111'} />
        </TouchableOpacity>
      </View>

      <AddSheet
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSticker={addSticker}
        onNote={addNote}
        onPhoto={addPhoto}
        uploading={uploading}
      />
      <ItemMenu
        item={menuItem}
        myId={me?.id || ''}
        canRemove={!!menuItem && (menuItem.ownerId === me?.id || isHost)}
        onClose={() => setMenuId(null)}
        onReact={(e) => menuItem && room.react(menuItem.id, e)}
        onResize={(d) => menuItem && room.resize(menuItem.id, menuItem.scale + d)}
        onFront={() => { if (menuItem) room.bringToFront(menuItem.id); setMenuId(null); }}
        onEdit={(t) => menuItem && t && room.editText(menuItem.id, t)}
        onRemove={async () => {
          if (!menuItem) return;
          const id = menuItem.id;
          setMenuId(null);
          setSelectedId(null);
          const ok = await room.remove(id);
          if (!ok) Alert.alert('Not removed', 'Please try again.');
        }}
      />
    </View>
  );
}

const shadow = { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 };

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  pill: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },

  top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  titlePill: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, minHeight: 40, justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' },
  liveText: { fontSize: 11, fontWeight: '700', opacity: 0.85 },
  avatars: { flexDirection: 'row' },
  avatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 2 },
  avatarFallback: { backgroundColor: '#8B5CF6', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#FFF', fontSize: 12, fontWeight: '800' },

  themes: { position: 'absolute', right: 12, left: 12, flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FFF', borderRadius: 18, padding: 10, ...shadow },
  themeCell: { alignItems: 'center', gap: 4 },
  themeSwatch: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  themeOn: { borderWidth: 3, borderColor: '#111' },
  themeName: { fontSize: 10, fontWeight: '700', color: '#374151' },

  hintWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 32 },
  hint: { borderRadius: 18, paddingHorizontal: 20, paddingVertical: 16, alignItems: 'center' },
  hintTitle: { fontSize: 17, fontWeight: '800', marginBottom: 6 },
  hintText: { fontSize: 14, lineHeight: 20, textAlign: 'center', opacity: 0.85 },

  toolbar: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderRadius: 32, padding: 8, ...shadow },
  tool: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  toolOn: { backgroundColor: '#111827' },
  addBtn: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: '#8B5CF6' },

  penBar: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF', borderRadius: 26, paddingHorizontal: 10, paddingVertical: 8, ...shadow },
  penColor: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(0,0,0,0.12)' },
  penColorOn: { borderColor: '#38BDF8', transform: [{ scale: 1.2 }] },
  penWidth: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  penWidthOn: { backgroundColor: '#E0F2FE' },
  sep: { width: 1, height: 22, backgroundColor: '#E5E7EB', marginHorizontal: 2 },

  reactBar: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', gap: 4, backgroundColor: '#FFF', borderRadius: 28, paddingHorizontal: 8, paddingVertical: 6, ...shadow },
  reactBtn: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
});
