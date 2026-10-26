// TextPostBar.tsx — lightweight inline text-post input.
// Replaces the big PostComposer for text-only posts: a small bar where the
// user types and presses enter (or taps send) to publish immediately.

import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { TextInputInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Send } from 'lucide-react-native';

interface TextPostBarProps {
  visible: boolean;
  onClose: () => void;
  onPost: (text: string) => void;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  surfaceColor?: string;
  borderColor?: string;
}

export default function TextPostBar({
  visible,
  onClose,
  onPost,
  backgroundColor = '#000',
  textColor = '#FFF',
  accentColor = '#7B61FF',
  surfaceColor = '#1C1C1E',
  borderColor = '#2C2C2E',
}: TextPostBarProps) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInputInstance>(null);
  const [text, setText] = useState('');

  // Reset + autofocus each time the bar opens.
  useEffect(() => {
    if (visible) {
      setText('');
      const t = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onPost(trimmed);
    setText('');
  };

  const canPost = text.trim().length > 0;

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View
          style={[
            styles.bar,
            { backgroundColor: surfaceColor, borderColor, paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: textColor, backgroundColor: 'rgba(255,255,255,0.06)' }]}
            placeholder="Write something…"
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={text}
            onChangeText={setText}
            onSubmitEditing={submit}
            returnKeyType="send"
            maxLength={1000}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            onPress={submit}
            disabled={!canPost}
            style={[
              styles.sendBtn,
              { backgroundColor: canPost ? accentColor : 'rgba(255,255,255,0.15)' },
            ]}
            activeOpacity={0.8}
          >
            <Send size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 24,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
