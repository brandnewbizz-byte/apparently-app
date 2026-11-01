/**
 * WebRTC for voice and video calls on iOS and Android (react-native-webrtc).
 *
 * Loaded lazily and guarded: on an app build that doesn't include the native
 * module, calls are simply unavailable instead of crashing the app.
 */
import type { WebRTCApi } from './webrtc';

export type { WebRTCApi };

let cached: WebRTCApi | null | undefined;

export function getWebRTC(): WebRTCApi | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('react-native-webrtc');
    cached = m && m.RTCPeerConnection && m.mediaDevices ? (m as WebRTCApi) : null;
  } catch {
    cached = null;
  }
  return cached;
}

/** True when this device can make and receive calls. */
export function callsAvailable(): boolean {
  return !!getWebRTC();
}
