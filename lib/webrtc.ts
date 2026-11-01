/**
 * WebRTC for voice and video calls.
 *
 * Web uses the browser's built-in WebRTC. Phones use react-native-webrtc,
 * loaded in webrtc.native.ts (Metro picks that file on iOS and Android).
 */
export interface WebRTCApi {
  RTCPeerConnection: any;
  RTCSessionDescription: any;
  RTCIceCandidate: any;
  mediaDevices: { getUserMedia: (constraints: any) => Promise<any> };
  /** Native video view (phones only). */
  RTCView?: any;
}

export function getWebRTC(): WebRTCApi | null {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null;
  const w = window as any;
  if (!w.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) return null;
  return {
    RTCPeerConnection: w.RTCPeerConnection,
    RTCSessionDescription: w.RTCSessionDescription,
    RTCIceCandidate: w.RTCIceCandidate,
    mediaDevices: navigator.mediaDevices,
  };
}

/** True when this device can make and receive calls. */
export function callsAvailable(): boolean {
  return !!getWebRTC();
}
