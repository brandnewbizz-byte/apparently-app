import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { RefreshCw, X } from 'lucide-react-native';
import { CameraView, cameraNativeAvailable } from '@/lib/safe-camera';

const SIZE = 104;
const FRAME_MS = 1400;

/** A round bubble you can drag anywhere on screen. */
function DragBubble({ start, ring, children, label }: { start: { x: number; y: number }; ring?: string; children: React.ReactNode; label: string }) {
  const { width, height } = useWindowDimensions();
  const [pos, setPos] = useState(start);
  const ref = useRef({ pos, width, height });
  ref.current = { pos, width, height };
  const origin = useRef({ x: 0, y: 0 });
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) + Math.abs(g.dy) > 4,
    onPanResponderGrant: () => { origin.current = ref.current.pos; },
    onPanResponderMove: (_e, g) => {
      const { width: w, height: h } = ref.current;
      setPos({
        x: Math.min(w - SIZE - 6, Math.max(6, origin.current.x + g.dx)),
        y: Math.min(h - SIZE - 120, Math.max(60, origin.current.y + g.dy)),
      });
    },
  }), []);
  return (
    <View {...pan.panHandlers} style={[styles.bubble, { left: pos.x, top: pos.y, borderColor: ring || '#FFF' }]} accessibilityLabel={label}>
      {children}
    </View>
  );
}

/** Your own camera, live in a bubble. Sends a small snapshot every ~1.4s so others see you. */
export function MyCameraBubble({ onFrame, onClose, talking }: { onFrame: (b64: string) => void; onClose: () => void; talking: boolean }) {
  const cam = useRef<any>(null);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [ready, setReady] = useState(false);
  const busy = useRef(false);
  const frameFn = useRef(onFrame);
  frameFn.current = onFrame;
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (!ready) return;
    const t = setInterval(async () => {
      if (busy.current || !cam.current?.takePictureAsync) return;
      busy.current = true;
      try {
        const shot = await cam.current.takePictureAsync({ quality: 0.3, skipProcessing: true, shutterSound: false, base64: false });
        if (shot?.uri) {
          const small = await manipulateAsync(shot.uri, [{ resize: { width: 120 } }], { compress: 0.45, format: SaveFormat.JPEG, base64: true });
          if (small.base64) frameFn.current(small.base64);
        }
      } catch {
        // Camera busy — try again next tick.
      } finally {
        busy.current = false;
      }
    }, FRAME_MS);
    return () => clearInterval(t);
  }, [ready]);

  return (
    <DragBubble start={{ x: width - SIZE - 14, y: 120 }} ring={talking ? '#22C55E' : '#FFF'} label="Your camera">
      {cameraNativeAvailable ? (
        <CameraView
          ref={cam}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mirror={facing === 'front'}
          animateShutter={false}
          onCameraReady={() => setReady(true)}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noCam]}><Text style={styles.noCamText}>Camera unavailable</Text></View>
      )}
      <TouchableOpacity onPress={onClose} style={[styles.mini, { top: 6, right: 14 }]} accessibilityLabel="Turn camera off" hitSlop={8}>
        <X size={12} color="#FFF" />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))} style={[styles.mini, { bottom: 6, right: 14 }]} accessibilityLabel="Flip camera" hitSlop={8}>
        <RefreshCw size={11} color="#FFF" />
      </TouchableOpacity>
    </DragBubble>
  );
}

export interface RemoteCam { uid: string; name: string; img: string; at: number }

/** Everyone else who has their camera on. */
export function RemoteCameraBubbles({ cams, speaking }: { cams: RemoteCam[]; speaking: Record<string, number> }) {
  return (
    <>
      {cams.map((c, i) => (
        <DragBubble key={c.uid} start={{ x: 14, y: 120 + i * (SIZE + 14) }} ring={speaking[c.uid] ? '#22C55E' : '#FFF'} label={`${c.name}'s camera`}>
          <Image source={{ uri: `data:image/jpeg;base64,${c.img}` }} style={StyleSheet.absoluteFill} fadeDuration={0} />
          <View style={styles.nameTag}><Text style={styles.nameText} numberOfLines={1}>{c.name.split(' ')[0]}</Text></View>
        </DragBubble>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute', width: SIZE, height: SIZE, borderRadius: SIZE / 2, overflow: 'hidden',
    borderWidth: 3, backgroundColor: '#111', zIndex: 2000,
    ...(Platform.OS === 'web' ? {} : { elevation: 10 }),
  },
  mini: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  noCam: { alignItems: 'center', justifyContent: 'center', padding: 8 },
  noCamText: { color: '#FFF', fontSize: 10, textAlign: 'center' },
  nameTag: { position: 'absolute', bottom: 6, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, maxWidth: SIZE - 20 },
  nameText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
});
