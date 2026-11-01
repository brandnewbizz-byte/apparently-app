/**
 * Shows a call's video stream. Web version: a plain <video> element, which
 * also plays the other person's audio. (Phones use CallVideo.native.tsx.)
 */
import React, { useEffect, useRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

export interface CallVideoProps {
  stream: any | null;
  mirror?: boolean;
  muted?: boolean;
  cover?: boolean;
  zOrder?: number;
  style?: StyleProp<ViewStyle>;
}

export default function CallVideo({ stream, mirror, muted, cover = true, style }: CallVideoProps) {
  const ref = useRef<any>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || el.srcObject === stream) return;
    el.srcObject = stream || null;
    if (stream) el.play?.().catch(() => {});
  }, [stream]);

  return (
    <View style={style}>
      {React.createElement('video', {
        ref,
        autoPlay: true,
        playsInline: true,
        muted: !!muted,
        style: {
          width: '100%',
          height: '100%',
          objectFit: cover ? 'cover' : 'contain',
          transform: mirror ? 'scaleX(-1)' : undefined,
          backgroundColor: '#000',
        },
      })}
    </View>
  );
}
