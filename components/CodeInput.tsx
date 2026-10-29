import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface Props {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  /** Called once all digits are in. */
  onComplete?: (v: string) => void;
  error?: boolean;
  autoFocus?: boolean;
  accent: string;
  colors: { text: string; border: string; surface: string; error: string };
  testID?: string;
}

/**
 * One-time-code entry shown as separate boxes. A single hidden TextInput keeps
 * paste, SMS/email autofill and the system keyboard working normally.
 */
export default function CodeInput({ value, onChange, length = 6, onComplete, error, autoFocus, accent, colors, testID }: Props) {
  const ref = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (value.length === length) onComplete?.(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, length]);

  const digits = Array.from({ length }, (_, i) => value[i] || '');
  const active = Math.min(value.length, length - 1);

  return (
    <Pressable onPress={() => ref.current?.focus()} style={styles.row} accessibilityLabel="Code from the email">
      {digits.map((d, i) => {
        const isActive = focused && i === active;
        return (
          <View
            key={i}
            style={[
              styles.box,
              { borderColor: error ? colors.error : isActive ? accent : colors.border, backgroundColor: colors.surface },
              isActive && { borderWidth: 2 },
            ]}
          >
            <Text style={[styles.digit, { color: colors.text }]}>{d}</Text>
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        maxLength={length}
        autoFocus={autoFocus}
        caretHidden
        style={styles.hidden}
        testID={testID}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  box: {
    flex: 1,
    minWidth: 0,
    maxWidth: 52,
    aspectRatio: 0.82,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontSize: 24, fontWeight: '700' },
  // Covers the boxes so taps/paste land in the real input, but stays invisible.
  hidden: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.011, color: 'transparent', fontSize: 1 },
});
