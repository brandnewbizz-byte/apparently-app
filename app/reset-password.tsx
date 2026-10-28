import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';

import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';

/**
 * Password recovery screen.
 * Reached via the deep link `rork-app://reset-password` after the user clicks
 * the recovery email. Supabase fires a PASSWORD_RECOVERY event with a session;
 * we prompt for a new password and call updateUser({ password }).
 */
export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);

  // The recovery email opens `rork-app://reset-password#access_token=…&refresh_token=…`
  // (or `?code=…` for PKCE). The Supabase client runs with detectSessionInUrl
  // disabled, so nothing turns those tokens into a session unless we do it
  // here — without this the screen always said the link was invalid.
  const incomingUrl = Linking.useURL();

  // Detect the recovery session (deep link or in-app event)
  useEffect(() => {
    let cancelled = false;

    const establishSession = async () => {
      if (incomingUrl) {
        const [beforeHash, hash = ''] = incomingUrl.split('#');
        const query = beforeHash.includes('?') ? beforeHash.split('?')[1] : '';
        const params = new URLSearchParams(`${query}&${hash}`);
        const errorDescription = params.get('error_description');
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const code = params.get('code');
        if (errorDescription) {
          if (!cancelled) {
            setError(errorDescription.replace(/\+/g, ' '));
            setHasRecoverySession(false);
          }
          return;
        }
        if (accessToken && refreshToken) {
          const { error: setErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!cancelled) setHasRecoverySession(!setErr);
          return;
        }
        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (!cancelled) setHasRecoverySession(!exErr);
          return;
        }
      }
      const { data } = await supabase.auth.getSession();
      if (!cancelled) setHasRecoverySession(!!data.session);
    };

    establishSession().catch(() => {
      if (!cancelled) setHasRecoverySession(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setHasRecoverySession(true);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [incomingUrl]);

  const isValid = password.length >= 8 && password === confirmPassword;

  const handleSubmit = async () => {
    if (isSubmitting || !isValid) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setIsSubmitting(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
      } else {
        setDone(true);
        setTimeout(() => {
          router.replace('/(tabs)/(home)' as never);
        }, 1200);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.dark.background, Colors.dark.backgroundSecondary, Colors.dark.background]}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {done ? (
              <View style={styles.centerBox}>
                <CheckCircle2 size={56} color={Colors.dark.success} />
                <Text style={styles.title}>Password updated</Text>
                <Text style={styles.subtitle}>You can now sign in with your new password.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.title}>Set a new password</Text>
                <Text style={styles.subtitle}>
                  Enter a new password for your account (at least 8 characters).
                </Text>

                {hasRecoverySession === false && (
                  <View style={styles.warnBox}>
                    <AlertCircle size={18} color={Colors.dark.warning} />
                    <Text style={styles.warnText}>
                      Couldn&apos;t find a recovery session. Open the reset link from the email again.
                    </Text>
                  </View>
                )}

                <View style={styles.inputWrap}>
                  <Lock size={18} color={Colors.dark.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="New password"
                    placeholderTextColor={Colors.dark.textTertiary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="new-password"
                    textContentType="newPassword"
                  />
                  <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
                    {showPassword ? (
                      <EyeOff size={18} color={Colors.dark.textTertiary} />
                    ) : (
                      <Eye size={18} color={Colors.dark.textTertiary} />
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.inputWrap}>
                  <Lock size={18} color={Colors.dark.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm new password"
                    placeholderTextColor={Colors.dark.textTertiary}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirm}
                    autoCapitalize="none"
                    autoComplete="new-password"
                    textContentType="newPassword"
                  />
                  <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} hitSlop={10}>
                    {showConfirm ? (
                      <EyeOff size={18} color={Colors.dark.textTertiary} />
                    ) : (
                      <Eye size={18} color={Colors.dark.textTertiary} />
                    )}
                  </TouchableOpacity>
                </View>

                {error && (
                  <View style={styles.errorBox}>
                    <AlertCircle size={16} color={Colors.dark.error} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.button, (!isValid || isSubmitting) && styles.buttonDisabled]}
                  onPress={handleSubmit}
                  disabled={!isValid || isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>Update password</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.backLink}
                  onPress={() => router.replace('/welcome')}
                >
                  <Text style={styles.backText}>Back to sign in</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  gradient: { flex: 1 },
  keyboardView: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 28 },
  centerBox: { alignItems: 'center', marginTop: 80, gap: 12 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    lineHeight: 22,
    marginBottom: 24,
  },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 179, 0, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  warnText: { flex: 1, color: Colors.dark.warning, fontSize: 13, lineHeight: 18 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surfaceHighlight,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.dark.borderLight,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    height: 52,
    fontSize: 15,
    color: Colors.dark.text,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  errorText: { flex: 1, color: Colors.dark.error, fontSize: 13 },
  button: {
    backgroundColor: Colors.dark.accent,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  backLink: { alignItems: 'center', marginTop: 20 },
  backText: { color: Colors.dark.accent, fontSize: 15, fontWeight: '600' },
});
