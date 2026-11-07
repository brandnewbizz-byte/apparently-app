import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, AppState, Image, Modal, PanResponder, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Stack, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { ChevronLeft, Hand, PenLine, Plus, Smile, Undo2, Redo2, UserPlus, Palette, Mic, Video, VideoOff, Trash2, Lock, LockOpen, X, Crown } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTabBar } from '@/contexts/TabBarContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useSpotRoom } from '@/hooks/useSpotRoom';
import { useSpotVoice } from '@/hooks/useSpotVoice';
import { useLiveMesh } from '@/hooks/useLiveMesh';
import { useSpotHistory } from '@/hooks/useSpotHistory';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import CallVideo from '@/components/CallVideo';
import { useCameraPermissions } from '@/lib/safe-camera';
import {
  deleteRoom, getRoom, listInvites, themeFor, touchRoom, updateRoom, roomLink, PEN_COLORS, REACTIONS, SPOT_THEMES,
  type SpotPoint, type SpotRoom,
} from '@/lib/spot';
import { uploadImageToStorage } from '@/lib/storage';
import { roomUrl, shareLink } from '@/lib/share';
import DoodleLayer from '@/components/spot/DoodleLayer';
import BurstLayer from '@/components/spot/BurstLayer';
import SpotItemView from '@/components/spot/SpotItemView';
import { AddSheet, ItemMenu } from '@/components/spot/SpotSheets';
import { MyCameraBubble, MyLiveCameraBubble, RemoteCameraBubbles, type RemoteCam } from '@/components/spot/CameraBubbles';
import CutoutSheet, { type PhotoStyle, type PickedPhoto } from '@/components/spot/CutoutSheet';
import InviteSheet from '@/components/spot/InviteSheet';

type Mode = 'move' | 'draw';
const PEN_WIDTHS = [3, 6, 12];

const tap = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
  if (Platform.OS !== 'web') Haptics.impactAsync(style);
};
const nearCenter = () => 0.35 + Math.random() * 0.3;

/**
 * You're only in a Spot room while you're actually on its screen. Switching
 * tabs, opening another screen or putting the app away leaves the room: you
 * drop off the people list, your mic and camera turn off, and you stop
 * hearing the room. Coming back joins again.
 */
export default function SpotRoomScreen() {
  const focused = useIsFocused();
  const [inBackground, setInBackground] = useState(AppState.currentState === 'background');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setInBackground(st === 'background'));
    return () => sub.remove();
  }, []);
  if (!focused || inBackground) return <View style={{ flex: 1, backgroundColor: '#0A0A14' }} />;
  return <SpotRoomInner />;
}

function SpotRoomInner() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { requireSpot, checkUpload } = useSubscription();
  const { hideTabBar, showTabBar } = useTabBar();

  const me = useMemo(() => (user?.id ? { id: user.id, name: user.fullName || user.username || 'You', avatar: user.avatar || '' } : null), [user?.id, user?.fullName, user?.username, user?.avatar]);
  const room = useSpotRoom(roomId, me);
  const history = useSpotHistory(room);
  const [showPeople, setShowPeople] = useState(false);
  const dragStart = useRef<Record<string, { x: number; y: number; z: number }>>({});

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
  const [showInvite, setShowInvite] = useState(false);
  const [picked, setPicked] = useState<PickedPhoto | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [cams, setCams] = useState<Record<string, RemoteCam>>({});
  const [, requestCamera] = useCameraPermissions();

  // ── Voice and camera ─────────────────────────────────────────────────────
  // The mic is on while you hold the button, while the mic is locked on, or
  // while your camera is on. Turning the camera off turns the mic off again
  // unless you're holding it or locked it on.
  const live = useMemo(() => ({ send: room.send, on: room.on }), [room.send, room.on]);
  // Older app versions send recorded clips — keep hearing them.
  const clipVoice = useSpotVoice(live, me);
  // Real-time voice + camera (WebRTC). Without it we fall back to clips / snapshots.
  const mesh = useLiveMesh(live, me, { enabled: !!me, ready: room.connected });
  const useMesh = mesh.available;
  const [holding, setHolding] = useState(false);
  const [micLocked, setMicLocked] = useState(false);
  const micOn = holding || micLocked || camOn;
  const voice = { speaking: clipVoice.speaking, talking: useMesh ? micOn && mesh.publishing : clipVoice.talking };
  const lastDenied = useRef(0);

  const micDenied = () => {
    setHolding(false); setMicLocked(false); setCamOn(false);
    if (Date.now() - lastDenied.current < 3000) return;
    lastDenied.current = Date.now();
    Alert.alert('Microphone access needed', 'Allow microphone (and camera) access in Settings to talk in rooms.');
  };

  // Keep the mic / camera stream in step with what you asked for.
  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    (async () => {
      if (useMesh) {
        if (micOn) {
          const r = await mesh.publish({ video: camOn });
          if (cancelled) return;
          if (r !== 'ok') { micDenied(); return; }
          mesh.setMic(true);
        } else {
          mesh.setMic(false);
        }
        return;
      }
      // Older builds: clips for voice; the camera bubble sends snapshots.
      if (holding || micLocked) {
        const r = await clipVoice.startTalking();
        if (!cancelled && r === 'denied') micDenied();
      } else clipVoice.stopTalking();
    })();
    return () => { cancelled = true; };
  }, [micOn, camOn, holding, micLocked, useMesh, me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const micDown = () => {
    tap(Haptics.ImpactFeedbackStyle.Medium);
    if (micLocked) return; // locked on: a tap on the mic turns it off (see micUp)
    setHolding(true);
  };
  const micUp = () => {
    if (micLocked) { setMicLocked(false); tap(); return; }
    setHolding(false);
  };
  const toggleMicLock = () => {
    tap(Haptics.ImpactFeedbackStyle.Medium);
    setMicLocked((v) => !v);
    setHolding(false);
  };

  // Real-time voice: keep the green "talking" ring on for others while your mic is on.
  useEffect(() => {
    if (!useMesh || !voice.talking || !me) return;
    const ping = () => room.send('talk', { uid: me.id, on: true });
    ping();
    const t = setInterval(ping, 2000);
    return () => { clearInterval(t); room.send('talk', { uid: me.id, on: false }); };
  }, [useMesh, voice.talking, me?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Mic off and no camera for a while: release the mic completely.
  useEffect(() => {
    if (!useMesh || !mesh.publishing || micOn) return;
    const t = setTimeout(() => mesh.unpublish(), 30_000);
    return () => clearTimeout(t);
  }, [useMesh, mesh.publishing, micOn]); // eslint-disable-line react-hooks/exhaustive-deps

  // The phone going to sleep / the app going to the background stops the
  // camera and mic, so the buttons must show that too (no "red" camera that's
  // really off when you come back).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') return;
      setHolding(false);
      setMicLocked(false);
      setCamOn((on) => { if (on && me) room.send('camOff', { uid: me.id }); return false; });
      mesh.unpublish();
      clipVoice.stopTalking();
    });
    return () => sub.remove();
  }, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // The stream stopped by itself (e.g. the camera was taken by another app).
  useEffect(() => {
    if (useMesh && camOn && !mesh.publishing && !mesh.starting) {
      const t = setTimeout(() => { if (!mesh.publishing) setCamOn(false); }, 1500);
      return () => clearTimeout(t);
    }
  }, [useMesh, camOn, mesh.publishing, mesh.starting]);

  // Stay awake while you're in the room (Spot live). The lock button still works.
  useEffect(() => {
    activateKeepAwakeAsync('spot-room').catch(() => {});
    return () => { try { deactivateKeepAwake('spot-room'); } catch {} };
  }, []);

  // ── Camera bubbles ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!me) return;
    const offCam = room.on('cam', (p) => {
      if (!p?.uid || p.uid === me.id || !p.img) return;
      setCams((prev) => ({ ...prev, [p.uid]: { uid: p.uid, name: p.name || 'Someone', img: p.img, at: Date.now() } }));
    });
    const offCamOff = room.on('camOff', (p) => setCams((prev) => { if (!prev[p?.uid]) return prev; const n = { ...prev }; delete n[p.uid]; return n; }));
    const sweep = setInterval(() => setCams((prev) => {
      const stale = Object.values(prev).filter((c) => Date.now() - c.at > 7000);
      if (!stale.length) return prev;
      const n = { ...prev };
      stale.forEach((c) => delete n[c.uid]);
      return n;
    }), 2000);
    return () => { offCam(); offCamOff(); clearInterval(sweep); };
  }, [room.on, me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCamera = async () => {
    tap();
    if (camOn) {
      setCamOn(false);
      if (me) room.send('camOff', { uid: me.id });
      return;
    }
    if (!useMesh) {
      const perm = await requestCamera();
      if (!perm?.granted) { Alert.alert('Camera access needed', 'Allow camera access in Settings to show your camera in rooms.'); return; }
    }
    setCamOn(true); // the mic comes on with it
  };
  const sendFrame = useCallback((img: string) => {
    if (me) room.send('cam', { uid: me.id, name: me.name, img });
  }, [room.send, me]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (me) room.send('camOff', { uid: me.id }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Full-screen room: hide the tab bar while inside.
  useEffect(() => { hideTabBar(); return () => showTabBar(); }, [hideTabBar, showTabBar]);

  useEffect(() => {
    if (!roomId) return;
    getRoom(roomId).then(async (r) => {
      setInfo(r);
      if (r && me) {
        // Spot needs a plan — unless it's your room or you were invited.
        const invited = r.creatorId === me.id || (await listInvites(me.id).catch(() => [])).some((i) => i.roomId === r.id);
        if (!(await requireSpot({ invited }))) { router.back(); return; }
        touchRoom(r, me.id);
      }
    }).finally(() => setInfoLoading(false));
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  const theme = themeFor(info?.theme);
  const isHost = !!me && info?.creatorId === me.id;
  const things = room.items.filter((i) => i.kind !== 'doodle');
  const doodles = room.items.filter((i) => i.kind === 'doodle');
  const menuItem = menuId ? room.items.find((i) => i.id === menuId) || null : null;

  // ── Drawing ───────────────────────────────────────────────────────────────
  const drawRef = useRef({ mode, size, penColor, penWidth, points: [] as SpotPoint[] });
  drawRef.current.mode = mode;
  drawRef.current.size = size;
  drawRef.current.penColor = penColor;
  drawRef.current.penWidth = penWidth;
  const strokeFns = useRef({ progress: room.strokeProgress, done: room.strokeDone, rec: history.recordAdd });
  strokeFns.current = { progress: room.strokeProgress, done: room.strokeDone, rec: history.recordAdd };

  const canvasPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => drawRef.current.mode === 'draw',
    onMoveShouldSetPanResponder: () => drawRef.current.mode === 'draw',
    onPanResponderTerminationRequest: () => true,
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
      strokeFns.current.done(pts, drawRef.current.penColor, drawRef.current.penWidth)
        .then((it) => strokeFns.current.rec(it))
        .finally(() => setMyStroke([]));
    },
    // A second finger means "zoom", so drop the half-drawn stroke.
    onPanResponderTerminate: () => {
      drawRef.current.points = [];
      strokeFns.current.done([], drawRef.current.penColor, drawRef.current.penWidth).finally(() => setMyStroke([]));
    },
  }), []);

  // ── Pinch to zoom / two-finger pan ────────────────────────────────────────
  const [view, setView] = useState({ s: 1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const pinch = useRef({ d0: 1, m0: { x: 0, y: 0 }, v0: { s: 1, tx: 0, ty: 0 } });
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const touchInfo = (e: any) => {
    const t = e.nativeEvent.touches || [];
    if (t.length < 2) return null;
    const a = t[0]; const b = t[1];
    return { d: Math.max(1, Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY)), m: { x: (a.pageX + b.pageX) / 2, y: (a.pageY + b.pageY) / 2 } };
  };
  const clampView = (v: { s: number; tx: number; ty: number }) => {
    const { w, h } = sizeRef.current;
    const s2 = Math.min(4, Math.max(1, v.s));
    const mx = (w * (s2 - 1)) / 2; const my = (h * (s2 - 1)) / 2;
    return { s: s2, tx: Math.min(mx, Math.max(-mx, v.tx)), ty: Math.min(my, Math.max(-my, v.ty)) };
  };
  const zoomHandlers = {
    onStartShouldSetResponderCapture: (e: any) => (e.nativeEvent.touches?.length || 0) >= 2,
    onMoveShouldSetResponderCapture: (e: any) => (e.nativeEvent.touches?.length || 0) >= 2,
    onResponderTerminationRequest: () => true,
    onResponderGrant: (e: any) => {
      const t = touchInfo(e);
      if (t) pinch.current = { d0: t.d, m0: t.m, v0: viewRef.current };
    },
    onResponderMove: (e: any) => {
      const t = touchInfo(e);
      if (!t) return;
      const { d0, m0, v0 } = pinch.current;
      const { w, h } = sizeRef.current;
      const s2 = Math.min(4, Math.max(1, v0.s * (t.d / d0)));
      // Keep the spot under your fingers where it is while zooming.
      const cx = w / 2; const cy = h / 2;
      setView(clampView({
        s: s2,
        tx: t.m.x - cx - (s2 * (m0.x - cx - v0.tx)) / v0.s,
        ty: t.m.y - cy - (s2 * (m0.y - cy - v0.ty)) / v0.s,
      }));
    },
  };
  const zoomed = view.s > 1.01;

  const liveStrokes = useMemo(() => {
    const list = Object.values(room.liveStrokes);
    if (myStroke.length) list.push({ points: myStroke, color: penColor, width: penWidth });
    return list;
  }, [room.liveStrokes, myStroke, penColor, penWidth]);

  const undoLast = () => { tap(); history.undo(); };
  const redoLast = () => { tap(); history.redo(); };

  // ── Adding things ─────────────────────────────────────────────────────────
  const addSticker = async (emoji: string) => {
    setShowAdd(false);
    tap(Haptics.ImpactFeedbackStyle.Medium);
    setMode('move');
    const it = await room.add({ kind: 'sticker', emoji, x: nearCenter(), y: nearCenter() });
    history.recordAdd(it);
    if (!it) Alert.alert('Not added', 'Check your connection and try again.');
  };
  const addNote = async (text: string, color: string) => {
    setShowAdd(false);
    tap(Haptics.ImpactFeedbackStyle.Medium);
    setMode('move');
    const it = await room.add({ kind: 'note', text, color, x: nearCenter(), y: nearCenter() });
    history.recordAdd(it);
    if (!it) Alert.alert('Not added', 'Check your connection and try again.');
  };
  const addPhoto = async (source: 'camera' | 'library') => {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(source === 'camera' ? 'Camera access needed' : 'Photos access needed', 'Allow access in Settings to add photos to the room.');
      return;
    }
    // Let the add sheet finish closing before the camera / picker opens —
    // presenting over a closing sheet can freeze iOS.
    setShowAdd(false);
    await new Promise((r) => setTimeout(r, 450));
    // No built-in crop: it would flatten transparent (already cut-out) PNGs.
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.85 };
    let r: ImagePicker.ImagePickerResult;
    try {
      r = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    } catch {
      Alert.alert('Camera not available', 'Try choosing a photo from your library instead.');
      return;
    }
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    setPreparing(true);
    try {
      // Camera photos are huge (12MP+). Shrink once, up front, so tracing and
      // uploading stay fast.
      const png = a.mimeType === 'image/png' || /\.png($|\?)/i.test(a.uri);
      const w = a.width || 0;
      const small = w > 1280 || !w
        ? await manipulateAsync(a.uri, [{ resize: { width: Math.min(1280, w || 1280) } }], { compress: 0.8, format: png ? SaveFormat.PNG : SaveFormat.JPEG })
        : { uri: a.uri, width: w, height: a.height || w };
      setPicked({ uri: small.uri, width: small.width || 1, height: small.height || 1, mimeType: png ? 'image/png' : 'image/jpeg' });
    } catch {
      Alert.alert('Photo not added', 'That photo could not be opened. Try another one.');
    } finally {
      setPreparing(false);
    }
  };

  const placePhoto = async (style: PhotoStyle, outline?: SpotPoint[]) => {
    if (!picked) return;
    setUploading(true);
    try {
      let png = picked.mimeType === 'image/png';
      let uri = picked.uri;
      let aspect = picked.width / Math.max(1, picked.height);
      let cutout = style === 'cutout' && outline && outline.length > 2 ? outline : undefined;
      if (cutout) {
        // Crop the file itself down to the traced area, so only the object is
        // ever uploaded — then the outline clips it to the exact shape.
        const W = picked.width; const H = picked.height;
        const xs = cutout.map((p) => p.x * W); const ys = cutout.map((p) => p.y * H);
        const pad = Math.round(Math.max(W, H) * 0.01);
        const ox = Math.max(0, Math.floor(Math.min(...xs)) - pad);
        const oy = Math.max(0, Math.floor(Math.min(...ys)) - pad);
        const cw = Math.min(W - ox, Math.ceil(Math.max(...xs)) + pad - ox);
        const ch = Math.min(H - oy, Math.ceil(Math.max(...ys)) + pad - oy);
        if (cw > 8 && ch > 8) {
          const cropped = await manipulateAsync(picked.uri, [{ crop: { originX: ox, originY: oy, width: cw, height: ch } }], { compress: 0.85, format: SaveFormat.JPEG });
          uri = cropped.uri;
          png = false;
          aspect = cw / ch;
          cutout = cutout.map((p) => ({
            x: Math.min(1, Math.max(0, (p.x * W - ox) / cw)),
            y: Math.min(1, Math.max(0, (p.y * H - oy) / ch)),
          }));
        }
      }
      const url = await uploadImageToStorage(uri, 'room-files', `spot/${roomId}`, 3, png ? 'image/png' : 'image/jpeg');
      if (!url || url.startsWith('file:')) throw new Error('upload failed');
      setMode('move');
      const it = await room.add({
        kind: 'photo', imageUrl: url, x: nearCenter(), y: 0.55 + Math.random() * 0.2,
        aspect,
        cutout,
        bare: style === 'bare',
      });
      if (!it) throw new Error('save failed');
      history.recordAdd(it);
      tap(Haptics.ImpactFeedbackStyle.Medium);
      setPicked(null);
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
  const onDrag = useCallback((id: string, x: number, y: number, z: number) => {
    if (!dragStart.current[id]) {
      const it = room.items.find((i) => i.id === id);
      if (it) dragStart.current[id] = { x: it.x, y: it.y, z: it.z };
    }
    setSelectedId(id);
    room.dragTo(id, x, y, z);
  }, [room]);
  const onDrop = useCallback((id: string, x: number, y: number, z: number) => {
    const from = dragStart.current[id];
    delete dragStart.current[id];
    if (from) history.recordMove(id, from, { x, y, z });
    room.dropAt(id, x, y, z);
  }, [room, history]);

  const invite = () => {
    tap();
    setShowInvite(false);
    if (roomId) shareLink(`Come hang out in my room "${info?.name || 'Spot'}" on Apparently 🎈`, roomUrl(roomId));
  };

  const changeTheme = async (id: string) => {
    if (!info) return;
    setShowThemes(false);
    const prev = info;
    setInfo({ ...info, theme: id });
    try { await updateRoom(info.id, { theme: id }); } catch { setInfo(prev); }
  };

  const removeRoom = () => {
    if (!info) return;
    tap(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(`Delete "${info.name}"?`, 'Everything in this room will be removed for everyone. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete room', style: 'destructive',
        onPress: async () => {
          try { await deleteRoom(info.id); router.replace('/(tabs)/live' as any); }
          catch { Alert.alert('Not deleted', 'Please try again.'); }
        },
      },
    ]);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const fg = theme.dark ? '#FFF' : '#111827';
  const glass = theme.dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.75)';

  if (!infoLoading && !info) {
    return (
      <View style={[styles.center, { backgroundColor: '#0B1026' }]}>
        <Stack.Screen options={{ headerShown: false, gestureEnabled: false, fullScreenGestureEnabled: false }} />
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
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false, fullScreenGestureEnabled: false }} />
      <LinearGradient colors={theme.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      {/* ── Canvas (pinch to zoom) ── */}
      <View style={StyleSheet.absoluteFill} {...zoomHandlers}>
      <View
        style={[StyleSheet.absoluteFill, { transform: [{ translateX: view.tx }, { translateY: view.ty }, { scale: view.s }] }]}
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
            zoom={view.s}
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
      </View>
        <BurstLayer bursts={room.bursts} width={size.w} height={size.h} />
      </View>

      {zoomed ? (
        <TouchableOpacity onPress={() => setView({ s: 1, tx: 0, ty: 0 })} style={[styles.zoomPill, { top: insets.top + 56 }]} accessibilityLabel="Reset zoom">
          <Text style={styles.zoomText}>{Math.round(view.s * 100)}% · Reset</Text>
        </TouchableOpacity>
      ) : null}

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
        <TouchableOpacity
          onPress={() => { tap(); setShowPeople(true); }}
          style={[styles.titlePill, { backgroundColor: glass }]}
          accessibilityLabel={`Live: ${room.members.length} here. Show who's in the room`}
        >
          <Text style={[styles.title, { color: fg }]} numberOfLines={1}>{theme.emoji} {info?.name || 'Room'}</Text>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={[styles.liveText, { color: fg }]}>LIVE · {room.members.length} here ›</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.avatars} onPress={() => { tap(); setShowPeople(true); }} accessibilityLabel="Show who's in the room">
          {room.members.slice(0, 4).map((m, i) => {
            const talkingNow = m.id === me?.id ? voice.talking : !!voice.speaking[m.id];
            const ring = talkingNow ? '#22C55E' : theme.colors[0];
            return m.avatar ? (
              <Image key={m.id} source={{ uri: m.avatar }} style={[styles.avatar, { marginLeft: i ? -10 : 0, borderColor: ring }]} />
            ) : (
              <View key={m.id} style={[styles.avatar, styles.avatarFallback, { marginLeft: i ? -10 : 0, borderColor: ring }]}>
                <Text style={styles.avatarInitial}>{(m.name || '?').charAt(0).toUpperCase()}</Text>
              </View>
            );
          })}
        </TouchableOpacity>
        {isHost ? (
          <TouchableOpacity onPress={() => setShowThemes((v) => !v)} style={[styles.round, { backgroundColor: glass }]} accessibilityLabel="Change room theme">
            <Palette size={19} color={fg} />
          </TouchableOpacity>
        ) : null}
        {isHost ? (
          <TouchableOpacity onPress={removeRoom} style={[styles.round, { backgroundColor: glass }]} accessibilityLabel="Delete room">
            <Trash2 size={18} color={fg} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={() => { tap(); setShowInvite(true); }} style={[styles.round, { backgroundColor: glass }]} accessibilityLabel="Invite friends">
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

      {/* ── Who's talking ── */}
      {(() => {
        const names = room.members.filter((m) => m.id !== me?.id && voice.speaking[m.id]).map((m) => m.name.split(' ')[0]);
        if (voice.talking) names.unshift('You');
        if (!names.length) return null;
        return (
          <View pointerEvents="none" style={[styles.talkPill, { top: insets.top + 56 }]}>
            <Mic size={13} color="#FFF" />
            <Text style={styles.talkText} numberOfLines={1}>{names.join(', ')} {names.length > 1 || names[0] === 'You' ? 'talking' : 'is talking'}…</Text>
          </View>
        );
      })()}

      {/* ── Camera bubbles ── */}
      <RemoteCameraBubbles
        cams={[
          ...mesh.remotes.filter((r) => r.video).map((r) => ({ uid: r.uid, name: r.name, stream: r.stream, at: Date.now() })),
          ...Object.values(cams).filter((c) => !mesh.remotes.some((r) => r.uid === c.uid && r.video)),
        ]}
        speaking={voice.speaking}
      />
      {/* Browsers need a player to hear live voices (phones play them by themselves). */}
      {Platform.OS === 'web'
        ? mesh.remotes.filter((r) => !r.video).map((r) => <CallVideo key={r.uid} stream={r.stream} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />)
        : null}
      {camOn
        ? (useMesh && mesh.localStream
          ? <MyLiveCameraBubble stream={mesh.localStream} onClose={toggleCamera} onFlip={mesh.switchCamera} talking={voice.talking} />
          : useMesh ? null : <MyCameraBubble onFrame={sendFrame} onClose={toggleCamera} talking={voice.talking} />)
        : null}

      {/* ── Undo / Redo (move mode; the pen bar has its own) ── */}
      {mode !== 'draw' && (history.canUndo || history.canRedo) ? (
        <View style={[styles.historyCol, { bottom: insets.bottom + (showReact ? 152 : 100) }]}>
          <TouchableOpacity onPress={undoLast} disabled={!history.canUndo} style={[styles.sideBtn, !history.canUndo && { opacity: 0.35 }]} accessibilityLabel="Undo">
            <Undo2 size={19} color="#111" />
          </TouchableOpacity>
          <TouchableOpacity onPress={redoLast} disabled={!history.canRedo} style={[styles.sideBtn, !history.canRedo && { opacity: 0.35 }]} accessibilityLabel="Redo">
            <Redo2 size={19} color="#111" />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── Mic + camera ── */}
      <View style={[styles.sideCol, { bottom: insets.bottom + (mode === 'draw' || showReact ? 152 : 100) }]} pointerEvents="box-none">
        <TouchableOpacity onPress={toggleCamera} style={[styles.sideBtn, camOn && styles.sideBtnOn]} accessibilityLabel={camOn ? 'Turn camera off' : 'Turn camera on'}>
          {camOn ? <VideoOff size={20} color="#FFF" /> : <Video size={20} color="#111" />}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={toggleMicLock}
          style={[styles.lockBtn, micLocked && styles.lockBtnOn]}
          accessibilityLabel={micLocked ? 'Unlock the mic (back to hold to talk)' : 'Lock the mic on'}
          accessibilityState={{ selected: micLocked }}
        >
          {micLocked ? <Lock size={15} color="#FFF" /> : <LockOpen size={15} color="#111" />}
        </TouchableOpacity>
        <Pressable
          onPressIn={micDown}
          onPressOut={micUp}
          style={[styles.micBtn, micOn && styles.micBtnOn]}
          accessibilityLabel={micLocked ? 'Mic locked on. Tap to turn it off' : 'Hold to talk'}
          accessibilityHint={micLocked ? undefined : 'Press and hold to speak, or tap the lock to keep the mic on'}
        >
          <Mic size={26} color="#FFF" />
        </Pressable>
        <Text style={[styles.micHint, { color: fg }]}>
          {micLocked ? 'Mic on · tap to stop' : camOn ? 'Mic on with camera' : holding ? 'Talking…' : 'Hold to talk'}
        </Text>
      </View>

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
          <TouchableOpacity onPress={undoLast} disabled={!history.canUndo} style={[styles.penWidth, !history.canUndo && { opacity: 0.3 }]} accessibilityLabel="Undo">
            <Undo2 size={18} color="#111" />
          </TouchableOpacity>
          <TouchableOpacity onPress={redoLast} disabled={!history.canRedo} style={[styles.penWidth, !history.canRedo && { opacity: 0.3 }]} accessibilityLabel="Redo">
            <Redo2 size={18} color="#111" />
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
      {preparing ? (
        <View style={[StyleSheet.absoluteFill, styles.preparing]}>
          <ActivityIndicator color="#FFF" size="large" />
          <Text style={styles.preparingText}>Getting your photo ready…</Text>
        </View>
      ) : null}
      <CutoutSheet photo={picked} busy={uploading} onCancel={() => !uploading && setPicked(null)} onDone={placePhoto} />
      {/* ── Who's here ── */}
      <Modal visible={showPeople} transparent animationType="slide" onRequestClose={() => setShowPeople(false)}>
        <Pressable style={styles.peopleBackdrop} onPress={() => setShowPeople(false)}>
          <Pressable style={[styles.peopleSheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
            <View style={styles.peopleHead}>
              <View style={styles.liveDot} />
              <Text style={styles.peopleTitle}>Live now · {room.members.length}</Text>
              <TouchableOpacity onPress={() => setShowPeople(false)} accessibilityLabel="Close" hitSlop={10}>
                <X size={20} color="#111" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 380 }}>
              {room.members.map((m) => {
                const isMe = m.id === me?.id;
                const talkingNow = isMe ? voice.talking : !!voice.speaking[m.id];
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={styles.personRow}
                    disabled={isMe}
                    onPress={() => { setShowPeople(false); router.push(`/user/${m.id}` as any); }}
                    accessibilityLabel={`${m.name}${isMe ? ' (you)' : ''}${talkingNow ? ', talking' : ''}`}
                  >
                    {m.avatar ? (
                      <Image source={{ uri: m.avatar }} style={[styles.personAvatar, talkingNow && styles.personTalking]} />
                    ) : (
                      <View style={[styles.personAvatar, styles.avatarFallback, talkingNow && styles.personTalking]}>
                        <Text style={styles.avatarInitial}>{(m.name || '?').charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <Text style={styles.personName} numberOfLines={1}>{m.name}{isMe ? ' (you)' : ''}</Text>
                    {m.id === info?.creatorId ? <Crown size={15} color="#F59E0B" /> : null}
                    {talkingNow ? <Mic size={15} color="#22C55E" /> : null}
                  </TouchableOpacity>
                );
              })}
              {!room.members.length ? <Text style={styles.personEmpty}>Connecting…</Text> : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      <InviteSheet
        visible={showInvite}
        room={info}
        me={me}
        hereIds={room.members.map((m) => m.id)}
        onClose={() => setShowInvite(false)}
        onShareLink={invite}
      />
      <ItemMenu
        item={menuItem}
        myId={me?.id || ''}
        canRemove={!!menuItem && (menuItem.ownerId === me?.id || isHost)}
        onClose={() => setMenuId(null)}
        onReact={(e) => menuItem && room.react(menuItem.id, e)}
        onResize={(d) => {
          if (!menuItem) return;
          const to = Math.min(3, Math.max(0.5, menuItem.scale + d));
          history.recordResize(menuItem.id, menuItem.scale, to);
          room.resize(menuItem.id, to);
        }}
        onFront={() => { if (menuItem) room.bringToFront(menuItem.id); setMenuId(null); }}
        onEdit={(t) => {
          if (!menuItem || !t) return;
          history.recordEdit(menuItem.id, menuItem.text || '', t);
          room.editText(menuItem.id, t);
        }}
        onRemove={async () => {
          if (!menuItem) return;
          const id = menuItem.id;
          const snapshot = menuItem;
          setMenuId(null);
          setSelectedId(null);
          const ok = await room.remove(id);
          if (!ok) Alert.alert('Not removed', 'Please try again.');
          else history.recordRemove(snapshot);
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

  zoomPill: { position: 'absolute', right: 14, backgroundColor: 'rgba(17,24,39,0.85)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, zIndex: 50 },
  zoomText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  preparing: { zIndex: 4000, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', gap: 12 },
  preparingText: { color: '#FFF', fontWeight: '700' },
  talkPill: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(34,197,94,0.92)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5, maxWidth: '80%' },
  talkText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  sideCol: { position: 'absolute', right: 14, alignItems: 'center', gap: 10 },
  historyCol: { position: 'absolute', left: 14, gap: 10 },
  lockBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', ...shadow },
  lockBtnOn: { backgroundColor: '#22C55E' },
  peopleBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  peopleSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 16 },
  peopleHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  peopleTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: '#111' },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  personAvatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: 'transparent' },
  personTalking: { borderColor: '#22C55E' },
  personName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111' },
  personEmpty: { color: '#6B7280', paddingVertical: 12, textAlign: 'center' },
  sideBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', ...shadow },
  sideBtnOn: { backgroundColor: '#EF4444' },
  micBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)', ...shadow },
  micBtnOn: { backgroundColor: '#22C55E', transform: [{ scale: 1.12 }] },
  micHint: { fontSize: 11, fontWeight: '800', marginTop: -4, textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 3 },

  reactBar: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', gap: 4, backgroundColor: '#FFF', borderRadius: 28, paddingHorizontal: 8, paddingVertical: 6, ...shadow },
  reactBtn: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
});
