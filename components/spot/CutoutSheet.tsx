import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, PanResponder, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Polygon, Polyline } from 'react-native-svg';
import { RotateCcw, Scissors, Square, Sparkles, X } from 'lucide-react-native';
import type { SpotPoint } from '@/lib/spot';

export interface PickedPhoto { uri: string; width: number; height: number; mimeType?: string | null }
export type PhotoStyle = 'cutout' | 'frame' | 'bare';

interface Props {
  photo: PickedPhoto | null;
  busy: boolean;
  onCancel: () => void;
  onDone: (style: PhotoStyle, outline?: SpotPoint[]) => void;
}

/** Keep the outline light: drop points that are very close together, cap the count. */
function simplify(points: SpotPoint[], max = 140): SpotPoint[] {
  if (points.length <= max) return points;
  const step = points.length / max;
  const out: SpotPoint[] = [];
  for (let i = 0; i < max; i++) out.push(points[Math.floor(i * step)]);
  return out;
}

const area = (pts: SpotPoint[]) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]; const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a / 2);
};

/**
 * Photo → room. Trace around the thing you want (a car, a person, a pizza…)
 * and only that part goes into the room, as a sticker with a white edge.
 */
export default function CutoutSheet({ photo, busy, onCancel, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const { width: SW, height: SH } = useWindowDimensions();
  const isPng = !!photo && (photo.mimeType === 'image/png' || /\.png($|\?)/i.test(photo.uri));
  const [style, setStyle] = useState<PhotoStyle>('cutout');
  const [points, setPoints] = useState<SpotPoint[]>([]);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    // Already-cut-out stickers (e.g. iPhone "lift subject") go in as they are.
    setStyle(isPng ? 'bare' : 'cutout');
    setPoints([]);
    setClosed(false);
  }, [photo?.uri]); // eslint-disable-line react-hooks/exhaustive-deps

  const aspect = photo && photo.width && photo.height ? photo.width / photo.height : 1;
  const maxW = SW - 32;
  const maxH = SH * 0.56;
  const dw = Math.min(maxW, maxH * aspect);
  const dh = dw / aspect;

  const ref = useRef({ dw, dh, style, pts: [] as SpotPoint[] });
  ref.current.dw = dw; ref.current.dh = dh; ref.current.style = style;

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => ref.current.style === 'cutout',
    onMoveShouldSetPanResponder: () => ref.current.style === 'cutout',
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      const { locationX, locationY } = e.nativeEvent;
      ref.current.pts = [{ x: locationX / ref.current.dw, y: locationY / ref.current.dh }];
      setClosed(false);
      setPoints(ref.current.pts);
    },
    onPanResponderMove: (e) => {
      const { locationX, locationY } = e.nativeEvent;
      const p = { x: Math.min(1, Math.max(0, locationX / ref.current.dw)), y: Math.min(1, Math.max(0, locationY / ref.current.dh)) };
      const pts = ref.current.pts;
      const last = pts[pts.length - 1];
      if (last && Math.hypot((p.x - last.x) * ref.current.dw, (p.y - last.y) * ref.current.dh) < 3) return;
      ref.current.pts = [...pts, p];
      setPoints(ref.current.pts);
    },
    onPanResponderRelease: () => {
      const pts = simplify(ref.current.pts);
      if (pts.length > 8 && area(pts) > 0.004) { setPoints(pts); setClosed(true); }
      else { setPoints([]); setClosed(false); }
    },
  }), []);

  const svgPts = points.map((p) => `${p.x * dw},${p.y * dh}`).join(' ');
  const outsideMask = closed
    ? `M0 0 H${dw} V${dh} H0 Z M${points.map((p) => `${p.x * dw} ${p.y * dh}`).join(' L')} Z`
    : '';
  const canAdd = style !== 'cutout' || closed;

  const styleBtn = (id: PhotoStyle, label: string, Icon: any) => (
    <TouchableOpacity
      key={id}
      onPress={() => setStyle(id)}
      style={[styles.seg, style === id && styles.segOn]}
      accessibilityLabel={label}
      accessibilityState={{ selected: style === id }}
    >
      <Icon size={15} color={style === id ? '#111' : '#FFF'} />
      <Text style={[styles.segText, style === id && { color: '#111' }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    // A plain full-screen layer, not a Modal: stacking a Modal right after the
    // camera / photo picker closes froze the app on iOS.
    !photo ? null : (
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.round} accessibilityLabel="Cancel photo"><X size={20} color="#FFF" /></TouchableOpacity>
          <Text style={styles.title}>{style === 'cutout' ? 'Cut it out' : 'Add photo'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.help}>
          {style === 'cutout'
            ? closed ? 'Nice! Only the part inside the line goes in the room.' : 'Trace around the thing you want with your finger.'
            : style === 'bare' ? 'Goes in exactly as it is — great for photos that are already cut out.' : 'Goes in as a framed photo.'}
        </Text>

        <View style={styles.stage}>
          {photo ? (
            <View style={{ width: dw, height: dh }} {...pan.panHandlers} testID="cutout-canvas">
              <Image source={{ uri: photo.uri }} style={{ width: dw, height: dh, borderRadius: style === 'frame' ? 4 : 0 }} resizeMode="cover" />
              {style === 'cutout' ? (
                <Svg width={dw} height={dh} style={StyleSheet.absoluteFill} pointerEvents="none">
                  {closed ? <Path d={outsideMask} fill="rgba(0,0,0,0.72)" fillRule="evenodd" /> : null}
                  {closed ? (
                    <Polygon points={svgPts} fill="none" stroke="#FFF" strokeWidth={3} strokeLinejoin="round" />
                  ) : points.length > 1 ? (
                    <Polyline points={svgPts} fill="none" stroke="#FFF" strokeWidth={3} strokeDasharray="8 6" strokeLinecap="round" strokeLinejoin="round" />
                  ) : null}
                </Svg>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.segRow}>
          {styleBtn('cutout', 'Cut out', Scissors)}
          {styleBtn('frame', 'Framed', Square)}
          {styleBtn('bare', 'As is', Sparkles)}
        </View>

        <View style={styles.actions}>
          {style === 'cutout' ? (
            <TouchableOpacity onPress={() => { setPoints([]); setClosed(false); }} disabled={!points.length} style={[styles.secondary, !points.length && { opacity: 0.4 }]} accessibilityLabel="Trace again">
              <RotateCcw size={16} color="#FFF" />
              <Text style={styles.secondaryText}>Redo</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => onDone(style, style === 'cutout' ? points : undefined)}
            disabled={!canAdd || busy}
            style={[styles.primary, (!canAdd || busy) && { opacity: 0.45 }]}
            accessibilityLabel="Put it in the room"
          >
            {busy ? <ActivityIndicator color="#111" /> : <Text style={styles.primaryText}>Put it in the room</Text>}
          </TouchableOpacity>
        </View>
      </View>
    )
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, zIndex: 5000, elevation: 50, backgroundColor: '#0B0B10', paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  help: { color: 'rgba(255,255,255,0.75)', fontSize: 14, textAlign: 'center', marginTop: 14, minHeight: 38 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  segRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 4, gap: 4, marginBottom: 14 },
  seg: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10 },
  segOn: { backgroundColor: '#FFF' },
  segText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10 },
  secondary: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)' },
  secondaryText: { color: '#FFF', fontWeight: '700' },
  primary: { flex: 1, height: 52, borderRadius: 16, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#111', fontSize: 16, fontWeight: '800' },
});
