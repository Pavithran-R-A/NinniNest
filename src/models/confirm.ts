import { Alert, Platform } from 'react-native';

export interface ConfirmButton {
  text: string;
  style?: 'cancel' | 'destructive' | 'default';
  onPress?: () => void | Promise<void>;
}

// Alert.alert is a no-op on web; this wrapper falls back to window.confirm so
// destructive flows get real confirmations in the browser too. Buttons are
// mapped: the first non-cancel button is the confirm action.
export function confirmDialog(title: string, message: string, buttons: ConfirmButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(
      title,
      message,
      buttons.map((b) => ({ text: b.text, style: b.style, onPress: () => void b.onPress?.() })),
      { cancelable: true }
    );
    return;
  }
  const cancel = buttons.find((b) => b.style === 'cancel');
  const action = buttons.find((b) => b.style !== 'cancel');
  if (!action) return;
  const ok = window.confirm(message ? `${title}\n\n${message}` : title);
  if (ok) void action.onPress?.();
  else void cancel?.onPress?.();
}
