/**
 * FeedPhoto — how a photo fills a full-screen feed post.
 *
 *  • Tall photos (like ones taken with the in-app camera) fill the whole
 *    screen, edge to edge and top to bottom.
 *  • Wider photos are shown whole (never cut off), centred over a blurred copy
 *    of themselves, with soft fades where the photo meets the blur so there's
 *    no hard edge.
 */
import React, { useEffect, useState } from 'react';
import { Image as RNImage, Platform, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/** Photos at least this close to the screen's shape fill it completely. */
// Only photos (almost) as tall as the screen fill it; a 9:16 card on a modern
// phone (about 9:19.5) would lose ~18% of its sides, so it's shown whole instead.
const FILL_RATIO = 0.95;

export default function FeedPhoto({ uri, width, height, style }: {
  uri: string;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(width && height ? { w: width, h: height } : null);

  useEffect(() => {
    if (width && height) { setSize({ w: width, h: height }); return; }
    let alive = true;
    RNImage.getSize(uri, (w, h) => { if (alive && w && h) setSize({ w, h }); }, () => {});
    return () => { alive = false; };
  }, [uri, width, height]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (!box || box.w !== w || box.h !== h) setBox({ w, h });
  };

  const photoTall = size ? size.h / size.w : 0;
  const screenTall = box ? box.h / box.w : 0;
  const fill = !!size && !!box && photoTall >= screenTall * FILL_RATIO;

  // Where the whole photo sits when it doesn't fill the screen.
  const shownH = box && size ? Math.min(box.h, box.w * photoTall) : 0;
  const top = box ? (box.h - shownH) / 2 : 0;
  const fade = Math.min(90, shownH * 0.18);

  return (
    <View style={[style, { overflow: 'hidden', backgroundColor: '#000' }]} onLayout={onLayout}>
      {fill || !size || !box ? (
        <RNImage source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <>
          <RNImage source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={Platform.OS === 'android' ? 14 : 32} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
          <RNImage source={{ uri }} style={{ position: 'absolute', left: 0, top, width: box.w, height: shownH }} resizeMode="cover" />
          {/* Soft edges where the photo meets the blur */}
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']}
            style={{ position: 'absolute', left: 0, right: 0, top, height: fade }}
          />
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.45)']}
            style={{ position: 'absolute', left: 0, right: 0, top: top + shownH - fade, height: fade }}
          />
        </>
      )}
    </View>
  );
}
