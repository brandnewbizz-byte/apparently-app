/**
 * Share a real web link (profile, post or Spot room) through the phone's share
 * sheet, so "Copy", Messages, WhatsApp etc. all get a link that opens.
 *
 * The link is always part of the message text, on iOS and Android.
 * Web: the browser share sheet, or the clipboard when there isn't one.
 */
import { Alert, Platform, Share } from 'react-native';
import { WEB_APP_URL } from '@/lib/profileLink';

export const profileUrl = (userId: string) => `${WEB_APP_URL}/user/${userId}`;
export const postUrl = (authorId: string, postId: string) => `${WEB_APP_URL}/user/${authorId}?post=${encodeURIComponent(postId)}`;
export const roomUrl = (roomId: string) => `${WEB_APP_URL}/live/room/${roomId}`;

export async function shareLink(text: string, url: string): Promise<void> {
  const message = text.trim();
  try {
    if (Platform.OS === 'web') {
      const nav: any = typeof navigator !== 'undefined' ? navigator : null;
      if (nav?.share) {
        await nav.share({ text: message, url });
        return;
      }
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(url);
        Alert.alert('Link copied', url);
        return;
      }
    }
    // The link is always written into the message itself, so every app the
    // person picks (Messages, WhatsApp, Instagram, Copy…) gets a working URL.
    // (iOS's separate `url` field is dropped by many apps.)
    await Share.share({ message: message ? `${message}\n\n${url}` : url, title: message || undefined });
  } catch {
    // cancelled
  }
}
