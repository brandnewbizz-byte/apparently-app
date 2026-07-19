import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Star, X, Send } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export type ReviewDraft = {
  requestId: string;
  reviewerId: string;
  revieweeId: string;
  title: string;
  subtitle?: string;
};

export default function ReviewModal({
  visible,
  onClose,
  colors,
  draft,
  onSubmit,
  isSubmitting,
}: {
  visible: boolean;
  onClose: () => void;
  colors: any;
  draft: ReviewDraft | null;
  onSubmit: (payload: { rating: number; text: string }) => void;
  isSubmitting: boolean;
}) {
  const [rating, setRating] = useState<number>(0);
  const [text, setText] = useState<string>('');

  const canSubmit = useMemo(() => rating >= 1 && rating <= 5 && !isSubmitting, [isSubmitting, rating]);

  const handleClose = useCallback(() => {
    setRating(0);
    setText('');
    onClose();
  }, [onClose]);

  const handlePick = useCallback((value: number) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setRating(value);
  }, []);

  const submit = useCallback(() => {
    if (!draft) return;
    if (!canSubmit) return;
    console.log('[ReviewModal] Submitting review:', {
      requestId: draft.requestId,
      reviewerId: draft.reviewerId,
      revieweeId: draft.revieweeId,
      rating,
      textLen: text.length,
    });
    onSubmit({ rating, text: text.trim() });
  }, [canSubmit, draft, onSubmit, rating, text]);

  if (!draft) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}
          testID="reviewModal"
        >
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {draft.title}
              </Text>
              {!!draft.subtitle && (
                <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                  {draft.subtitle}
                </Text>
              )}
            </View>

            <TouchableOpacity
              onPress={handleClose}
              style={[styles.closeBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              testID="reviewModalClose"
            >
              <X size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Stars</Text>

            <View style={styles.starsRow}>
              {([1, 2, 3, 4, 5] as const).map((v) => {
                const active = v <= rating;
                return (
                  <TouchableOpacity
                    key={v}
                    onPress={() => handlePick(v)}
                    style={[styles.starBtn, { backgroundColor: active ? '#FFB30020' : 'transparent' }]}
                    testID={`reviewStar_${v}`}
                  >
                    <Star
                      size={26}
                      color={active ? '#FFB300' : colors.textTertiary}
                      fill={active ? '#FFB300' : 'transparent'}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 14 }]}>Review</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Share details (optional)"
              placeholderTextColor={colors.textTertiary}
              multiline
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              testID="reviewTextInput"
            />
          </View>

          <TouchableOpacity
            onPress={submit}
            disabled={!canSubmit}
            activeOpacity={0.9}
            style={[styles.submitWrap, { opacity: canSubmit ? 1 : 0.6 }]}
            testID="reviewSubmit"
          >
            <LinearGradient
              colors={canSubmit ? ['#FFB300', '#FF7A00'] : [colors.border, colors.border]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.submitBtn}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Send size={18} color="#fff" />
                  <Text style={styles.submitText}>Submit rating</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={[styles.footerHint, { color: colors.textTertiary }]}>
            Your rating helps build trust in the community.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    borderWidth: 1,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    backgroundColor: '#C7CBD1',
    marginBottom: 12,
    opacity: 0.6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800' as const,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500' as const,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  starBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 110,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  submitWrap: {
    marginTop: 14,
  },
  submitBtn: {
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  submitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800' as const,
  },
  footerHint: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 12,
    fontWeight: '500' as const,
  },
});
