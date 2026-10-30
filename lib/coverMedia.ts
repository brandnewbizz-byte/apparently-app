import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { persistableImageUri, uploadVideoToStorage } from '@/lib/storage';

export interface PickedCover { uri: string; type: 'image' | 'video' }

const MAX_VIDEO_MS = 60_000;
const MAX_WIDTH = 1280;

/** Open the photo library for a 16:9 cover. Returns null if cancelled/denied. */
export async function pickCover(allowVideo: boolean): Promise<PickedCover | null> {
  if (Platform.OS !== 'web') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos access needed', 'Allow access to your photos in Settings to add a cover.');
      return null;
    }
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: allowVideo ? ['images', 'videos'] : ['images'],
    quality: 0.85,
    allowsEditing: true,
    aspect: [16, 9],
    videoMaxDuration: 60,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const a = result.assets[0];
  if (a.type === 'video') {
    if (a.duration && a.duration > MAX_VIDEO_MS) {
      notify('Video too long', 'Pick a video under 60 seconds.');
      return null;
    }
    return { uri: a.uri, type: 'video' };
  }
  // Shrink big photos: faster uploads and far less data for everyone viewing them.
  try {
    const w = a.width || MAX_WIDTH;
    const out = await manipulateAsync(a.uri, w > MAX_WIDTH ? [{ resize: { width: MAX_WIDTH } }] : [], { compress: 0.78, format: SaveFormat.JPEG });
    return { uri: out.uri, type: 'image' };
  } catch {
    return { uri: a.uri, type: 'image' };
  }
}

const isRemote = (uri: string) => /^https?:\/\//i.test(uri);

/**
 * Upload a cover if it's still on the device. Remote URLs (an unchanged cover
 * while editing) pass straight through.
 */
export async function uploadCover(cover: PickedCover | null, folder: string): Promise<{ imageUrl: string; videoUrl?: string }> {
  if (!cover) return { imageUrl: '' };
  if (isRemote(cover.uri)) return cover.type === 'video' ? { imageUrl: '', videoUrl: cover.uri } : { imageUrl: cover.uri };
  if (cover.type === 'video') {
    const videoUrl = await uploadVideoToStorage(cover.uri, 'user-media', folder);
    if (!videoUrl || !isRemote(videoUrl)) throw new Error('The video could not be uploaded.');
    return { imageUrl: '', videoUrl };
  }
  const imageUrl = (await persistableImageUri(cover.uri, 'user-media', folder)) || '';
  if (!imageUrl) throw new Error('The photo could not be uploaded.');
  return { imageUrl };
}

/** A simple message box that also shows on the web (React Native's Alert does nothing there). */
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

/** Ask before throwing away unsaved work. Works on web too. */
export function confirmDiscard(message: string, onDiscard: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(message)) onDiscard();
    return;
  }
  Alert.alert('Discard changes?', message, [
    { text: 'Keep editing', style: 'cancel' },
    { text: 'Discard', style: 'destructive', onPress: onDiscard },
  ]);
}
