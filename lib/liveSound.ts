/**
 * One sound switch for live voice on every feed post: mute once and every post
 * you scroll to stays muted until you unmute. Remembered between app launches.
 */
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'apparently_live_sound_on';
let soundOn = true;
const subs = new Set<() => void>();

AsyncStorage.getItem(KEY).then((v) => {
  if (v === '0' && soundOn) { soundOn = false; subs.forEach((f) => f()); }
}).catch(() => {});

export function getLiveSound(): boolean {
  return soundOn;
}

export function setLiveSound(on: boolean): void {
  if (on === soundOn) return;
  soundOn = on;
  AsyncStorage.setItem(KEY, on ? '1' : '0').catch(() => {});
  subs.forEach((f) => f());
}

export function useLiveSound(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    (f) => { subs.add(f); return () => { subs.delete(f); }; },
    getLiveSound,
    getLiveSound,
  );
  return [on, setLiveSound];
}
