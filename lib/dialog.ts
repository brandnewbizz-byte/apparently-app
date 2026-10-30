/**
 * Message boxes and confirmations that also work on the web.
 * React Native's Alert does nothing in a browser (its buttons never fire), so on
 * the web these fall back to the browser's own alert / confirm.
 */
import { Alert, Platform } from 'react-native';

/** Show a message. */
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

/** Ask before doing something; `onYes` runs only if they agree. */
export function confirmAction(title: string, message: string | undefined, actionLabel: string, onYes: () => void, destructive = false) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(message ? `${title}\n\n${message}` : title)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: actionLabel, style: destructive ? 'destructive' : 'default', onPress: onYes },
  ]);
}
