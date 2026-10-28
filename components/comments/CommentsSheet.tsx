import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View, Dimensions } from 'react-native';
import { X } from 'lucide-react-native';
import CommentsPanel from './CommentsPanel';

interface Props {
  visible: boolean;
  onClose: () => void;
  postId: string;
  postOwnerId?: string | null;
  colors: any;
  onOpenProfile: (userId?: string) => void;
  autoFocus?: boolean;
  onCountChange?: (n: number) => void;
}

/** Bottom-sheet comments (Instagram/TikTok style) usable from any screen. */
export default function CommentsSheet({ visible, onClose, postId, postOwnerId, colors, onOpenProfile, autoFocus, onCountChange }: Props) {
  const [count, setCount] = useState(0);
  const handleCount = useCallback((n: number) => { setCount(n); onCountChange?.(n); }, [onCountChange]);
  const height = Math.round(Dimensions.get('window').height * 0.82);
  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close comments" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.anchor} pointerEvents="box-none">
        <View style={[styles.sheet, { height, backgroundColor: colors.background }]}>
          <View style={[styles.grab, { backgroundColor: colors.border }]} />
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={{ width: 32 }} />
            <Text style={[styles.title, { color: colors.text }]}>
              Comments{count > 0 ? <Text style={{ color: colors.textTertiary, fontWeight: '500' }}>  {count}</Text> : null}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.close} accessibilityLabel="Close">
              <X size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
          {visible && postId ? (
            <CommentsPanel
              postId={postId}
              postOwnerId={postOwnerId}
              colors={colors}
              autoFocus={autoFocus}
              onCountChange={handleCount}
              onOpenProfile={(id) => { onClose(); onOpenProfile(id); }}
            />
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden' },
  grab: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 16, fontWeight: '700' },
  close: { width: 32, alignItems: 'flex-end' },
});
