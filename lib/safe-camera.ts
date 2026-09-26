/**
 * safe-camera — guarded loader for expo-camera.
 *
 * The camera native module can be missing or version-mismatched on some
 * runtimes (e.g. JS upgraded to a newer Expo SDK than the installed binary).
 * This wrapper returns the real `CameraView` / `useCameraPermissions` when
 * available, and safe no-op fallbacks otherwise, so the room screen never
 * hard-crashes just because the camera isn't usable.
 */
import React from 'react';

let expoCamera: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  expoCamera = require('expo-camera');
} catch (e) {
  expoCamera = null;
}

// Renders nothing when the native camera view is unavailable.
function NullCameraView(_props: any) {
  return React.createElement(React.Fragment, null);
}

export const CameraView: any = expoCamera?.CameraView ?? NullCameraView;

// Permission hook mirroring expo-camera's return shape:
//   [permission, requestPermission, getPermission]
// Falls back to a never-granted permission when the native module is absent
// or its hook throws.
export function useCameraPermissions(): [any, () => Promise<any>, () => Promise<any>] {
  try {
    if (expoCamera?.useCameraPermissions) {
      return expoCamera.useCameraPermissions();
    }
  } catch (e) {
    // fall through to safe fallback
  }
  const denied = { granted: false, status: 'undetermined' };
  return [
    denied,
    async () => ({ granted: false, status: 'undetermined' }),
    async () => ({ granted: false, status: 'undetermined' }),
  ];
}

export const cameraNativeAvailable: boolean = expoCamera != null;

export default { CameraView, useCameraPermissions };
