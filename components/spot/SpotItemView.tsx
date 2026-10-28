import React, { memo, useMemo, useRef } from 'react';
import { Image, PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { ClipPath, Defs, Image as SvgImage, Polygon } from 'react-native-svg';
import type { SpotItem, SpotPoint } from '@/lib/spot';

/** Bounding box (0–1, image space) of a cut-out outline. */
export function cutoutBox(pts: SpotPoint[]) {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return { x0, y0, w: Math.max(0.01, x1 - x0), h: Math.max(0.01, y1 - y0) };
}

const fitLongest = (ratio: number, longest: number) => (ratio >= 1 ? { w: longest, h: longest / ratio } : { w: longest * ratio, h: longest });

/** Box size (pt) of an item before scaling. */
export function baseSize(it: SpotItem): { w: number; h: number } {
  if (it.kind === 'note') return { w: 132, h: 120 };
  if (it.kind === 'photo') {
    const aspect = it.aspect || 1;
    if (it.cutout) {
      const b = cutoutBox(it.cutout);
      return fitLongest((b.w * aspect) / b.h, 150);
    }
    if (it.bare) return fitLongest(aspect, 150);
    return { w: 136, h: 158 };
  }
  return { w: 64, h: 64 };
}

/** A photo clipped to its traced outline, with a white sticker edge. */
function CutoutImage({ item, w, h }: { item: SpotItem; w: number; h: number }) {
  const aspect = item.aspect || 1;
  const IW = 100 * aspect;
  const IH = 100;
  const b = cutoutBox(item.cutout || []);
  const pts = (item.cutout || []).map((p) => `${p.x * IW},${p.y * IH}`).join(' ');
  const pad = Math.max(b.w * IW, b.h * IH) * 0.05;
  const vb = `${b.x0 * IW - pad} ${b.y0 * IH - pad} ${b.w * IW + pad * 2} ${b.h * IH + pad * 2}`;
  const clipId = `cut-${item.id}`;
  return (
    <Svg width={w} height={h} viewBox={vb} style={styles.cutShadow}>
      <Defs>
        <ClipPath id={clipId}><Polygon points={pts} /></ClipPath>
      </Defs>
      <Polygon points={pts} fill="#FFF" stroke="#FFF" strokeWidth={pad * 1.4} strokeLinejoin="round" />
      {item.imageUrl ? (
        <SvgImage href={{ uri: item.imageUrl }} x={0} y={0} width={IW} height={IH} preserveAspectRatio="none" clipPath={`url(#${clipId})`} />
      ) : null}
    </Svg>
  );
}

interface Props {
  item: SpotItem;
  /** Position override while someone else is dragging it. */
  live?: { x: number; y: number; z: number } | null;
  canvasW: number;
  canvasH: number;
  enabled: boolean;
  topZ: number;
  myId: string;
  selected: boolean;
  onDrag: (id: string, x: number, y: number, z: number) => void;
  onDrop: (id: string, x: number, y: number, z: number) => void;
  onDoubleTap: (id: string) => void;
  onTap: (id: string) => void;
  onLongPress: (id: string) => void;
}

function SpotItemView({ item, live, canvasW, canvasH, enabled, topZ, myId, selected, onDrag, onDrop, onDoubleTap, onTap, onLongPress }: Props) {
  const x = live?.x ?? item.x;
  const y = live?.y ?? item.y;
  const z = live?.z ?? item.z;
  const { w, h } = baseSize(item);
  const sw = w * item.scale;
  const sh = h * item.scale;
  const k = item.scale;

  // Latest values for the gesture handlers (created once).
  const ref = useRef({ item, x, y, canvasW, canvasH, topZ, enabled, onDrag, onDrop, onDoubleTap, onTap, onLongPress });
  ref.current = { item, x, y, canvasW, canvasH, topZ, enabled, onDrag, onDrop, onDoubleTap, onTap, onLongPress };
  const g = useRef({ startX: 0, startY: 0, z: 0, moved: false, longFired: false, timer: null as ReturnType<typeof setTimeout> | null, lastTap: 0, last: { x: 0, y: 0 } });

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => ref.current.enabled,
    onMoveShouldSetPanResponder: () => ref.current.enabled,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      const s = ref.current;
      g.current.startX = s.x;
      g.current.startY = s.y;
      g.current.z = s.topZ + 1;
      g.current.moved = false;
      g.current.longFired = false;
      g.current.last = { x: s.x, y: s.y };
      if (g.current.timer) clearTimeout(g.current.timer);
      g.current.timer = setTimeout(() => {
        if (!g.current.moved) { g.current.longFired = true; ref.current.onLongPress(ref.current.item.id); }
      }, 450);
    },
    onPanResponderMove: (_e, gs) => {
      const s = ref.current;
      if (g.current.longFired) return;
      if (!g.current.moved && Math.abs(gs.dx) + Math.abs(gs.dy) < 6) return;
      if (!g.current.moved && g.current.timer) { clearTimeout(g.current.timer); g.current.timer = null; }
      g.current.moved = true;
      // Keep the whole item inside the room.
      const { w: bw, h: bh } = baseSize(s.item);
      const hx = (bw * s.item.scale) / 2 / Math.max(s.canvasW, 1);
      const hy = (bh * s.item.scale) / 2 / Math.max(s.canvasH, 1);
      const nx = Math.min(1 - hx, Math.max(hx, g.current.startX + gs.dx / Math.max(s.canvasW, 1)));
      const ny = Math.min(1 - hy, Math.max(hy, g.current.startY + gs.dy / Math.max(s.canvasH, 1)));
      g.current.last = { x: nx, y: ny };
      s.onDrag(s.item.id, nx, ny, g.current.z);
    },
    onPanResponderRelease: () => {
      const s = ref.current;
      if (g.current.timer) { clearTimeout(g.current.timer); g.current.timer = null; }
      if (g.current.longFired) return;
      if (g.current.moved) {
        s.onDrop(s.item.id, g.current.last.x, g.current.last.y, g.current.z);
        return;
      }
      const now = Date.now();
      if (now - g.current.lastTap < 300) { g.current.lastTap = 0; s.onDoubleTap(s.item.id); }
      else { g.current.lastTap = now; s.onTap(s.item.id); }
    },
    onPanResponderTerminate: () => {
      if (g.current.timer) { clearTimeout(g.current.timer); g.current.timer = null; }
      if (g.current.moved) ref.current.onDrop(ref.current.item.id, g.current.last.x, g.current.last.y, g.current.z);
    },
  }), []);

  const reactions = Object.entries(item.reactions || {}).filter(([, v]) => v.length).sort((a, b) => b[1].length - a[1].length).slice(0, 3);
  const beingMoved = !!live;

  return (
    <View
      {...pan.panHandlers}
      style={[
        styles.wrap,
        {
          left: x * canvasW - sw / 2,
          top: y * canvasH - sh / 2,
          width: sw,
          height: sh,
          zIndex: z + 10,
          transform: [{ rotate: `${item.rotation || 0}deg` }],
        },
      ]}
      pointerEvents={enabled ? 'auto' : 'none'}
      accessibilityLabel={item.kind === 'note' ? `Note: ${item.text}` : item.kind === 'sticker' ? `${item.emoji} sticker` : item.cutout ? 'Cut-out photo' : 'Photo'}
    >
      {item.kind === 'sticker' ? (
        <Text style={{ fontSize: 46 * k, lineHeight: 56 * k, textAlign: 'center' }}>{item.emoji}</Text>
      ) : item.kind === 'note' ? (
        <View style={[styles.note, { backgroundColor: item.color || '#FEF08A', padding: 10 * k }]}>
          <Text style={[styles.noteText, { fontSize: 14 * k, lineHeight: 18 * k }]} numberOfLines={6}>{item.text}</Text>
          <Text style={[styles.noteBy, { fontSize: 10 * k }]} numberOfLines={1}>— {item.ownerId === myId ? 'you' : item.ownerName.split(' ')[0]}</Text>
        </View>
      ) : item.cutout ? (
        <CutoutImage item={item} w={sw} h={sh} />
      ) : item.bare ? (
        item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={[styles.bare, { width: sw, height: sh }]} resizeMode="contain" /> : null
      ) : (
        <View style={[styles.polaroid, { padding: 6 * k, paddingBottom: 22 * k }]}>
          {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.photo} resizeMode="cover" /> : <View style={[styles.photo, { backgroundColor: '#E5E7EB' }]} />}
        </View>
      )}

      {selected || beingMoved ? <View pointerEvents="none" style={[styles.ring, beingMoved && styles.ringRemote]} /> : null}

      {reactions.length ? (
        <View pointerEvents="none" style={styles.reactions}>
          {reactions.map(([emoji, users]) => (
            <View key={emoji} style={[styles.chip, users.includes(myId) && styles.chipMine]}>
              <Text style={styles.chipText}>{emoji}{users.length > 1 ? ` ${users.length}` : ''}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default memo(SpotItemView);

const styles = StyleSheet.create({
  wrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  note: {
    width: '100%', height: '100%', borderRadius: 6, justifyContent: 'space-between',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  noteText: { color: '#1F2937', fontWeight: '600' },
  noteBy: { color: 'rgba(31,41,55,0.6)', fontWeight: '600', textAlign: 'right' },
  polaroid: {
    width: '100%', height: '100%', backgroundColor: '#FFF', borderRadius: 4,
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  photo: { flex: 1, borderRadius: 2 },
  bare: {},
  cutShadow: {},
  ring: { ...StyleSheet.absoluteFill, borderRadius: 10, borderWidth: 2, borderColor: '#38BDF8', margin: -6 },
  ringRemote: { borderColor: '#F472B6', borderStyle: 'dashed' },
  reactions: { position: 'absolute', bottom: -14, flexDirection: 'row', gap: 3, alignSelf: 'center' },
  chip: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  chipMine: { borderColor: '#38BDF8' },
  chipText: { fontSize: 11, fontWeight: '700', color: '#111' },
});
