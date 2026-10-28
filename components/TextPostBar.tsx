// TextPostBar.tsx — quick text-post sheet.
// A small bottom sheet (Cancel · Text post · Post) with a multi-line box,
// instead of the big PostComposer, for text-only posts.

import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
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
  const MAX = 1000;

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: surfaceColor, borderColor, paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Cancel text post">
              <Text style={[styles.cancel, { color: textColor }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: textColor }]}>Text post</Text>
            <TouchableOpacity
              onPress={submit}
              disabled={!canPost}
              style={[styles.postBtn, { backgroundColor: accentColor, opacity: canPost ? 1 : 0.4 }]}
              accessibilityLabel="Post"
            >
              <Send size={15} color="#FFF" />
              <Text style={styles.postText}>Post</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: textColor, backgroundColor, borderColor }]}
            placeholder="What's on your mind?"
            placeholderTextColor="#9CA3AF"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={MAX}
            textAlignVertical="top"
            accessibilityLabel="Post text"
          />
          <Text style={styles.counter}>{text.length}/{MAX}</Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cancel: { fontSize: 15, fontWeight: '500', opacity: 0.8 },
  title: { fontSize: 16, fontWeight: '700' },
  postBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 },
  postText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  input: {
    minHeight: 110,
    maxHeight: 240,
    fontSize: 17,
    lineHeight: 24,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  counter: { alignSelf: 'flex-end', fontSize: 12, color: '#9CA3AF' },
});
