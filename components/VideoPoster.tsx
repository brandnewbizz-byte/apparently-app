/**
 * VideoPoster — a still cover frame for a video, for places that show a
 * picture of the post (profile grid, feed before the video plays).
 *
 * Uses the saved cover (`coverUrl`) when the post has one; older posts that
 * were saved without a cover get one made on the phone from the video itself
 * (frame 1 second in, lib/videoThumb), kept in memory for the session.
 */
import React, { useEffect, useState } from 'react';
import { Image as RNImage, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Play } from 'lucide-react-native';
import { makeVideoCover } from '@/lib/videoThumb';

const cache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();

function coverFor(videoUrl: string): Promise<string | null> {
  if (cache.has(videoUrl)) return Promise.resolve(cache.get(videoUrl) ?? null);
  let p = pending.get(videoUrl);
  if (!p) {
    p = makeVideoCover(videoUrl, { maxWidth: 480 }).then((uri) => {
      cache.set(videoUrl, uri);
      pending.delete(videoUrl);
      return uri;
    });
    pending.set(videoUrl, p);
  }
  return p;
}

export default function VideoPoster({ videoUrl, coverUrl, style, resizeMode = 'cover', showPlayIcon = false }: {
  videoUrl?: string | null;
  coverUrl?: string | null;
  style?: StyleProp<ViewStyle>;
  resizeMode?: 'cover' | 'contain';
  showPlayIcon?: boolean;
}) {
  const [made, setMade] = useState<string | null>(videoUrl && cache.has(videoUrl) ? cache.get(videoUrl) ?? null : null);

  useEffect(() => {
    if (coverUrl || !videoUrl || Platform.OS === 'web') return;
    let alive = true;
    coverFor(videoUrl).then((uri) => { if (alive) setMade(uri); });
    return () => { alive = false; };
  }, [videoUrl, coverUrl]);

  const uri = coverUrl || made;
  return (
    <View style={[styles.box, style]}>
      {uri ? <RNImage source={{ uri }} style={StyleSheet.absoluteFill} resizeMode={resizeMode} /> : null}
      {showPlayIcon || !uri ? (
        <View style={styles.center} pointerEvents="none">
          <Play size={28} color="rgba(255,255,255,0.9)" fill="rgba(255,255,255,0.9)" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#111', overflow: 'hidden' },
  center: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
