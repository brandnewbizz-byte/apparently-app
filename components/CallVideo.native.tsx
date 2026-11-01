/**
 * Shows a call's video stream on iOS and Android (react-native-webrtc RTCView).
 * Audio plays on its own, so this is only needed for video.
 */
import React from 'react';
import { View } from 'react-native';
import type { CallVideoProps } from './CallVideo';
import { getWebRTC } from '@/lib/webrtc';

export default function CallVideo({ stream, mirror, cover = true, zOrder = 0, style }: CallVideoProps) {
  const RTCView = getWebRTC()?.RTCView;
  if (!stream || !RTCView || typeof stream.toURL !== 'function') return <View style={style} />;
  return (
    <RTCView
      streamURL={stream.toURL()}
      mirror={!!mirror}
      objectFit={cover ? 'cover' : 'contain'}
      zOrder={zOrder}
      style={style}
    />
  );
}
