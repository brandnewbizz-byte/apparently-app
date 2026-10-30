/**
 * React Native Web's Alert.alert shows nothing and never calls the buttons, so
 * every "Are you sure?" in the app silently did nothing on the website (Log out,
 * Delete, Decline...). On the web, route Alert.alert through the browser's own
 * alert / confirm instead. Imported once from app/_layout.tsx.
 */
import { Alert, Platform, type AlertButton } from 'react-native';

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  (Alert as any).alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = message ? `${title}\n\n${message}` : title;
    const list = buttons || [];
    const actions = list.filter((b) => b.style !== 'cancel');
    const cancel = list.find((b) => b.style === 'cancel');
    if (actions.length === 0) {
      window.alert(text);
      (cancel || list[0])?.onPress?.();
      return;
    }
    if (list.length === 1) {
      window.alert(text);
      list[0].onPress?.();
      return;
    }
    // Several choices: OK runs the main one (the destructive one if there is one, else the last).
    const main = actions.find((b) => b.style === 'destructive') || actions[actions.length - 1];
    if (window.confirm(`${text}\n\nOK = ${main.text || 'Continue'}`)) main.onPress?.();
    else cancel?.onPress?.();
  };
}

export {};
