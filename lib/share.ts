/**
 * Share a real web link (profile, post or Spot room) through the phone's share
 * sheet, so "Copy", Messages, WhatsApp etc. all get a link that opens.
 *
 * iOS: the link goes in `url` (that's what "Copy" copies) and the text in
 * `message`. Android ignores `url`, so the link is appended to the message.
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
    if (Platform.OS === 'ios') {
      await Share.share({ message, url });
    } else {
      await Share.share({ message: message ? `${message}\n${url}` : url, title: message || undefined });
    }
  } catch {
    // cancelled
  }
}
