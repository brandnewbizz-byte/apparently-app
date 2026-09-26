/**
 * safe-av — guarded loader for expo-av's `Audio`.
 *
 * expo-av is deprecated (removed in SDK 54+) and its native module may be
 * missing or incompatible on some runtimes. This wrapper returns a working
 * `Audio` when available, and a no-op fallback otherwise, so importing it
 * never crashes the app.
 */
import { Platform } from 'react-native';

let Audio: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const av = require('expo-av');
  Audio = av.Audio;
} catch (e) {
  Audio = null;
}

const noop = () => Promise.resolve();

// No-op fallback implementing only the surface the app touches.
const fallbackAudio: any = {
  AndroidOutputFormat: { DEFAULT: 0 },
  AndroidAudioEncoder: { DEFAULT: 0 },
  IOSOutputFormat: { LINEARPCM: 'lpcm' },
  IOSAudioQuality: { MEDIUM: 0x20 },
  Recording: class {
    prepareToRecordAsync = noop;
    startAsync = noop;
    stopAndUnloadAsync = noop;
    getURI = () => null;
  },
  Sound: {
    createAsync: async () => ({ sound: { unloadAsync: noop, loadAsync: noop } }),
  },
  requestPermissionsAsync: async () => ({ granted: false }),
  setAudioModeAsync: noop,
};

export const SafeAudio: any = Audio ?? fallbackAudio;
export const audioNativeAvailable: boolean = Audio != null;

export default SafeAudio;
