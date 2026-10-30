import { useUsernameCheck } from '@/hooks/useUsernameCheck';
import { USERNAME_MAX, PRIVACY_POLICY_URL, TERMS_URL } from '@/constants/app';
import { Linking } from 'react-native';
import {
  ArrowRight, ArrowLeft, User, Lock, AtSign, AlertCircle, Eye, EyeOff, Mail, MailCheck, KeyRound, CheckCircle2,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import CodeInput from '@/components/CodeInput';

/**
 * Sign in / sign up / confirm email / reset password.
 *
 *   login  ─┬─> (signed in)
 *           └─> verify   (email not confirmed yet)
 *   signup ───> verify   (code from the email, or tap the link and come back)
 *   forgot ───> reset    (code from the email + new password)
 */
type AuthMode = 'login' | 'signup' | 'verify' | 'forgot' | 'reset';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_LEN = 6;
const RESEND_SECONDS = 60;

const C = Colors.dark;
const haptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
  if (Platform.OS !== 'web') Haptics.impactAsync(style).catch(() => undefined);
};

/** Seconds left before "Send a new code" works again. */
function useCooldown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return { left, start: useCallback((s: number = RESEND_SECONDS) => setLeft(s), []) };
}

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const {
    signIn,
    signUp,
    resendVerificationEmail,
    verifyEmailCode,
    isBlocked,
    resetPassword,
    resetPasswordWithCode,
    clearError,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');

  // Sign in
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  // Sign up
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Confirm email
  const [verifyEmail, setVerifyEmail] = useState('');
  const [code, setCode] = useState('');
  const [verifyFrom, setVerifyFrom] = useState<'login' | 'signup'>('signup');
  // Password reset
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [resetDone, setResetDone] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const cooldown = useCooldown();

  // The password typed during this visit, so we can sign in by ourselves once
  // the person confirms by tapping the email link and comes back to the app.
  const pendingCreds = useRef<{ id: string; password: string } | null>(null);

  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [slideAnim] = useState(() => new Animated.Value(40));
  const [formFade] = useState(() => new Animated.Value(1));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const go = useCallback((next: AuthMode) => {
    Animated.sequence([
      Animated.timing(formFade, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(formFade, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    setMode(next);
    setError(null);
    setNotice(null);
    clearError();
  }, [formFade, clearError]);

  // ── Validity ──────────────────────────────────────────────────────────────
  const signupUsername = useUsernameCheck(mode === 'signup' ? username : '');
  const loginValid = loginId.trim().length >= 3 && loginPassword.length >= 6;
  const usernameOk = signupUsername.state === 'available' || signupUsername.state === 'error';
  const signupValid =
    fullName.trim().length >= 2 && EMAIL_RE.test(email.trim()) && usernameOk &&
    password.length >= 8 && confirmPassword === password;
  const resetValid = code.length === CODE_LEN && newPassword.length >= 8 && newPassword === newPassword2;

  // ── Actions ───────────────────────────────────────────────────────────────
  const toVerify = useCallback((addr: string, creds?: { id: string; password: string }, justSent = false) => {
    setVerifyEmail(addr);
    setCode('');
    setVerifyFrom(justSent ? 'signup' : 'login');
    if (creds) pendingCreds.current = creds;
    if (justSent) cooldown.start();
    go('verify');
  }, [cooldown, go]);

  const handleLogin = async () => {
    if (busy || !loginValid) return;
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    setBusy(true); setError(null);
    const id = loginId.trim();
    const res = await signIn(id, loginPassword);
    setBusy(false);
    if (res.success) return;
    if (res.needsEmailVerification && res.email) {
      toVerify(res.email, { id, password: loginPassword });
      setNotice('Your email isn’t confirmed yet. Enter the code we sent, or ask for a new one.');
      return;
    }
    setError(res.error || 'Could not sign in.');
  };

  const handleSignup = async () => {
    if (busy || !signupValid) return;
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    setBusy(true); setError(null);
    const addr = email.trim().toLowerCase();
    const res = await signUp(addr, username.trim(), password, fullName.trim());
    setBusy(false);
    if (!res.success) { setError(res.error || 'Could not create your account.'); return; }
    if (res.needsEmailVerification) toVerify(addr, { id: addr, password }, true);
    // Otherwise a session exists and the app moves on by itself.
  };

  const handleVerify = async (value = code) => {
    if (busy || value.length < CODE_LEN || !verifyEmail) return;
    setBusy(true); setError(null);
    const res = await verifyEmailCode(verifyEmail, value);
    setBusy(false);
    if (!res.success) { setError(res.error || 'That code didn’t work.'); setCode(''); return; }
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    // Signed in: the root layout takes over and opens the app.
  };

  const handleResendSignup = async () => {
    if (cooldown.left > 0 || !verifyEmail) return;
    setError(null);
    const res = await resendVerificationEmail(verifyEmail);
    if (!res.success) { setError(res.error || 'Could not send a new code.'); return; }
    cooldown.start();
    setCode('');
    setNotice(`New code sent to ${verifyEmail}.`);
  };

  // Tapped the link in the email instead? Try to sign in with what they typed.
  const tryAutoSignIn = useCallback(async (manual = false) => {
    const creds = pendingCreds.current;
    if (!creds) {
      if (manual) { setLoginId(verifyEmail); go('login'); }
      return;
    }
    if (manual) setBusy(true);
    const res = await signIn(creds.id, creds.password);
    if (manual) setBusy(false);
    if (res.success) { pendingCreds.current = null; return; }
    if (manual) setError(res.needsEmailVerification ? 'Not confirmed yet. Enter the code, or tap the link in the email first.' : res.error || 'Could not sign in.');
  }, [signIn, verifyEmail, go]);

  useEffect(() => {
    if (mode !== 'verify') return;
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') tryAutoSignIn(false); });
    return () => sub.remove();
  }, [mode, tryAutoSignIn]);

  const handleSendReset = async (again = false) => {
    if (busy || !EMAIL_RE.test(resetEmail.trim())) return;
    if (again && cooldown.left > 0) return;
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    setBusy(true); setError(null);
    const res = await resetPassword(resetEmail.trim());
    setBusy(false);
    if (!res.success) { setError(res.error || 'Could not send the email.'); return; }
    cooldown.start();
    setCode('');
    if (again) setNotice(`New code sent to ${resetEmail.trim().toLowerCase()}.`);
    else go('reset');
  };

  const handleReset = async () => {
    if (busy || !resetValid) return;
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    setBusy(true); setError(null);
    const res = await resetPasswordWithCode(resetEmail.trim(), code, newPassword);
    setBusy(false);
    if (!res.success) { setError(res.error || 'Could not change your password.'); return; }
    setResetDone(true);
    // verifyOtp signed them in; the app opens on its own.
  };

  // ── Copy per step ─────────────────────────────────────────────────────────
  const HEAD: Record<AuthMode, { title: string; sub: string }> = {
    login: { title: 'Welcome back', sub: 'Sign in with your email or username' },
    signup: { title: 'Create your account', sub: 'It takes less than a minute' },
    verify: { title: 'Check your email', sub: `Enter the ${CODE_LEN}-digit code we sent to` },
    forgot: { title: 'Forgot your password?', sub: 'We’ll email you a code to set a new one' },
    reset: { title: 'Set a new password', sub: `Enter the ${CODE_LEN}-digit code we sent to` },
  };

  const passwordEye = (
    <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={10} accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
      {showPassword ? <EyeOff size={20} color={C.textTertiary} /> : <Eye size={20} color={C.textTertiary} />}
    </TouchableOpacity>
  );

  const codeColors = { text: C.text, border: C.border, surface: C.backgroundSecondary, error: C.error };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[C.background, C.backgroundSecondary, C.background]} style={styles.gradient}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View style={[styles.hero, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <Image source={require('@/assets/images/icon.png')} style={styles.logoImage} accessibilityLabel="Apparently logo" />
              <Text style={styles.title}>Apparently</Text>
            </Animated.View>

            <Animated.View style={[styles.card, { opacity: formFade }]}>
              {mode === 'verify' || mode === 'reset' || mode === 'forgot' ? (
                <View style={styles.stepIcon}>
                  {mode === 'verify' ? <MailCheck size={26} color={C.accent} /> : <KeyRound size={26} color={C.accent} />}
                </View>
              ) : null}
              <Text style={styles.cardTitle}>{HEAD[mode].title}</Text>
              <Text style={styles.cardSub}>
                {HEAD[mode].sub}
                {mode === 'verify' ? <Text style={styles.strong}>{`\n${verifyEmail}`}</Text> : null}
                {mode === 'reset' ? <Text style={styles.strong}>{`\n${resetEmail.trim().toLowerCase()}`}</Text> : null}
              </Text>

              {isBlocked ? (
                <View style={[styles.banner, styles.bannerError]} testID="account-suspended-banner">
                  <AlertCircle size={16} color={C.error} />
                  <Text style={styles.bannerText}>This account has been suspended. If you think this is a mistake, contact support.</Text>
                </View>
              ) : null}
              {notice ? (
                <View style={[styles.banner, styles.bannerInfo]}>
                  <CheckCircle2 size={16} color={C.success} />
                  <Text style={styles.bannerText}>{notice}</Text>
                </View>
              ) : null}
              {error ? (
                <View style={[styles.banner, styles.bannerError]} testID="auth-error">
                  <AlertCircle size={16} color={C.error} />
                  <Text style={styles.bannerText}>{error}</Text>
                </View>
              ) : null}

              {/* ── Sign in ───────────────────────────────────────────── */}
              {mode === 'login' && (
                <>
                  <Field icon={<Mail size={20} color={C.textTertiary} />}>
                    <TextInput
                      style={styles.input}
                      placeholder="Email or username"
                      placeholderTextColor={C.textTertiary}
                      value={loginId}
                      onChangeText={(t) => { setLoginId(t); setError(null); }}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      textContentType="username"
                      autoComplete="username"
                      returnKeyType="next"
                      testID="email-login-input"
                    />
                  </Field>
                  <Field icon={<Lock size={20} color={C.textTertiary} />} right={passwordEye}>
                    <TextInput
                      style={styles.input}
                      placeholder="Password"
                      placeholderTextColor={C.textTertiary}
                      value={loginPassword}
                      onChangeText={(t) => { setLoginPassword(t); setError(null); }}
                      secureTextEntry={!showPassword}
                      textContentType="password"
                      autoComplete="current-password"
                      returnKeyType="go"
                      onSubmitEditing={handleLogin}
                      testID="password-input"
                    />
                  </Field>
                  <TouchableOpacity
                    style={styles.forgotLink}
                    onPress={() => { setResetEmail(EMAIL_RE.test(loginId.trim()) ? loginId.trim() : ''); go('forgot'); }}
                    testID="forgot-password-link"
                  >
                    <Text style={styles.linkText}>Forgot password?</Text>
                  </TouchableOpacity>
                  <PrimaryButton busy={busy} label="Sign in" onPress={handleLogin} disabled={!loginValid} testID="login-button" />
                  <View style={styles.switchRow}>
                    <Text style={styles.switchText}>New to Apparently?</Text>
                    <TouchableOpacity onPress={() => go('signup')} testID="switch-mode-button"><Text style={styles.linkText}>Create an account</Text></TouchableOpacity>
                  </View>
                </>
              )}

              {/* ── Sign up ───────────────────────────────────────────── */}
              {mode === 'signup' && (
                <>
                  <Field icon={<User size={20} color={C.textTertiary} />}>
                    <TextInput style={styles.input} placeholder="Full name" placeholderTextColor={C.textTertiary}
                      value={fullName} onChangeText={setFullName} autoCapitalize="words" textContentType="name" autoComplete="name" testID="fullname-input" />
                  </Field>
                  <Field icon={<Mail size={20} color={C.textTertiary} />} hint="We’ll send a code here to confirm it’s you"
                    hintColor={email.trim() && !EMAIL_RE.test(email.trim()) ? C.error : undefined}>
                    <TextInput style={styles.input} placeholder="Email" placeholderTextColor={C.textTertiary}
                      value={email} onChangeText={(t) => { setEmail(t); setError(null); }} autoCapitalize="none" autoCorrect={false}
                      keyboardType="email-address" textContentType="emailAddress" autoComplete="email" testID="email-input" />
                  </Field>
                  <Field
                    icon={<AtSign size={20} color={C.textTertiary} />}
                    hint={signupUsername.message || 'Letters, numbers, dots and underscores'}
                    hintColor={signupUsername.state === 'available' ? '#16A34A' : signupUsername.state === 'taken' || signupUsername.state === 'invalid' ? C.error : undefined}
                  >
                    <TextInput style={styles.input} placeholder="Username" placeholderTextColor={C.textTertiary}
                      value={username} onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
                      maxLength={USERNAME_MAX} autoCapitalize="none" autoCorrect={false} textContentType="username" autoComplete="username-new" testID="username-input" />
                  </Field>
                  <Field icon={<Lock size={20} color={C.textTertiary} />} right={passwordEye}
                    hint={password.length > 0 && password.length < 8 ? `${8 - password.length} more character${8 - password.length === 1 ? '' : 's'}` : 'At least 8 characters'}
                    hintColor={password.length > 0 && password.length < 8 ? C.error : undefined}>
                    <TextInput style={styles.input} placeholder="Password" placeholderTextColor={C.textTertiary}
                      value={password} onChangeText={setPassword} secureTextEntry={!showPassword}
                      textContentType="newPassword" autoComplete="new-password" testID="password-input" />
                  </Field>
                  <Field icon={<Lock size={20} color={C.textTertiary} />}
                    hint={confirmPassword.length > 0 && confirmPassword !== password ? 'Passwords don’t match' : undefined} hintColor={C.error}>
                    <TextInput style={styles.input} placeholder="Confirm password" placeholderTextColor={C.textTertiary}
                      value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPassword}
                      textContentType="newPassword" autoComplete="new-password" returnKeyType="go" onSubmitEditing={handleSignup} testID="confirm-password-input" />
                  </Field>
                  <PrimaryButton busy={busy} label="Create account" onPress={handleSignup} disabled={!signupValid} testID="signup-button" />
                  <View style={styles.switchRow}>
                    <Text style={styles.switchText}>Already have an account?</Text>
                    <TouchableOpacity onPress={() => go('login')} testID="switch-mode-button"><Text style={styles.linkText}>Sign in</Text></TouchableOpacity>
                  </View>
                </>
              )}

              {/* ── Confirm email ─────────────────────────────────────── */}
              {mode === 'verify' && (
                <>
                  <CodeInput value={code} onChange={(v) => { setCode(v); setError(null); }} length={CODE_LEN}
                    onComplete={(v) => handleVerify(v)} error={!!error} autoFocus accent={C.accent} colors={codeColors} testID="verify-code-input" />
                  <PrimaryButton busy={busy} label="Confirm email" onPress={() => handleVerify()} disabled={code.length < CODE_LEN} testID="verify-code-button" />
                  <TouchableOpacity style={styles.secondaryButton} onPress={handleResendSignup} disabled={cooldown.left > 0} testID="resend-verification-button">
                    <Text style={[styles.secondaryText, cooldown.left > 0 && { color: C.textTertiary }]}>
                      {cooldown.left > 0 ? `Send a new code in ${cooldown.left}s` : 'Send a new code'}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.tips}>
                    <Text style={styles.tip}>• It can take a minute. Check your spam or junk folder too.</Text>
                    <Text style={styles.tip}>• Tapped the link in the email instead?{' '}
                      <Text style={styles.linkInline} onPress={() => tryAutoSignIn(true)}>Continue</Text>
                    </Text>
                  </View>
                  <BackLink onBack={go} to={verifyFrom} label={verifyFrom === 'signup' ? 'Wrong email? Go back' : 'Back to sign in'} />
                </>
              )}

              {/* ── Forgot password ───────────────────────────────────── */}
              {mode === 'forgot' && (
                <>
                  <Field icon={<Mail size={20} color={C.textTertiary} />}>
                    <TextInput style={styles.input} placeholder="Email" placeholderTextColor={C.textTertiary}
                      value={resetEmail} onChangeText={(t) => { setResetEmail(t); setError(null); }} autoCapitalize="none" autoCorrect={false}
                      keyboardType="email-address" textContentType="emailAddress" autoComplete="email" returnKeyType="send"
                      onSubmitEditing={() => handleSendReset(false)} testID="forgot-email-input" />
                  </Field>
                  <PrimaryButton busy={busy} label="Email me a code" onPress={() => handleSendReset(false)} disabled={!EMAIL_RE.test(resetEmail.trim())} testID="reset-button" />
                  <BackLink onBack={go} to="login" label="Back to sign in" />
                </>
              )}

              {/* ── New password ──────────────────────────────────────── */}
              {mode === 'reset' && (
                resetDone ? (
                  <View style={styles.doneBox}>
                    <CheckCircle2 size={36} color={C.success} />
                    <Text style={styles.doneText}>Password changed. Signing you in…</Text>
                    <ActivityIndicator color={C.accent} />
                  </View>
                ) : (
                  <>
                    <CodeInput value={code} onChange={(v) => { setCode(v); setError(null); }} length={CODE_LEN}
                      error={!!error && /code/i.test(error)} autoFocus accent={C.accent} colors={codeColors} testID="reset-code-input" />
                    <Field icon={<Lock size={20} color={C.textTertiary} />} right={passwordEye}
                      hint={newPassword.length > 0 && newPassword.length < 8 ? `${8 - newPassword.length} more character${8 - newPassword.length === 1 ? '' : 's'}` : 'At least 8 characters'}
                      hintColor={newPassword.length > 0 && newPassword.length < 8 ? C.error : undefined}>
                      <TextInput style={styles.input} placeholder="New password" placeholderTextColor={C.textTertiary}
                        value={newPassword} onChangeText={setNewPassword} secureTextEntry={!showPassword}
                        textContentType="newPassword" autoComplete="new-password" testID="new-password-input" />
                    </Field>
                    <Field icon={<Lock size={20} color={C.textTertiary} />}
                      hint={newPassword2.length > 0 && newPassword2 !== newPassword ? 'Passwords don’t match' : undefined} hintColor={C.error}>
                      <TextInput style={styles.input} placeholder="Confirm new password" placeholderTextColor={C.textTertiary}
                        value={newPassword2} onChangeText={setNewPassword2} secureTextEntry={!showPassword}
                        textContentType="newPassword" autoComplete="new-password" returnKeyType="go" onSubmitEditing={handleReset} testID="new-password2-input" />
                    </Field>
                    <PrimaryButton busy={busy} label="Save new password" onPress={handleReset} disabled={!resetValid} testID="save-password-button" />
                    <TouchableOpacity style={styles.secondaryButton} onPress={() => handleSendReset(true)} disabled={cooldown.left > 0}>
                      <Text style={[styles.secondaryText, cooldown.left > 0 && { color: C.textTertiary }]}>
                        {cooldown.left > 0 ? `Send a new code in ${cooldown.left}s` : 'Send a new code'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.tip}>You can also tap the link in the email to reset it on the web.</Text>
                    <BackLink onBack={go} to="login" label="Back to sign in" />
                  </>
                )
              )}
            </Animated.View>

            {mode === 'signup' || mode === 'login' ? (
              <Text style={styles.footerText}>
                By continuing, you agree to our{' '}
                <Text style={styles.footerLink} onPress={() => Linking.openURL(TERMS_URL)} accessibilityRole="link">Terms of Use</Text>
                {' '}(no tolerance for objectionable content or abuse) and{' '}
                <Text style={styles.footerLink} onPress={() => Linking.openURL(PRIVACY_POLICY_URL)} accessibilityRole="link">Privacy Policy</Text>.
              </Text>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled, busy, testID }: { label: string; onPress: () => void; disabled: boolean; busy: boolean; testID: string }) {
  return (
    <TouchableOpacity
      style={[styles.primaryButton, (disabled || busy) && styles.primaryButtonDisabled]}
      onPress={onPress}
      disabled={disabled || busy}
      activeOpacity={0.85}
      testID={testID}
    >
      <LinearGradient colors={[C.accent, C.gradient2]} style={styles.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        {busy ? <ActivityIndicator color="#FFFFFF" /> : (
          <>
            <Text style={styles.primaryButtonText}>{label}</Text>
            <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

function BackLink({ to, label = 'Back', onBack }: { to: AuthMode; label?: string; onBack: (m: AuthMode) => void }) {
  return (
    <TouchableOpacity style={styles.backLink} onPress={() => onBack(to)} hitSlop={8} testID="back-link">
      <ArrowLeft size={16} color={C.textSecondary} />
      <Text style={styles.backLinkText}>{label}</Text>
    </TouchableOpacity>
  );
}

function Field({ icon, right, hint, hintColor, children }: {
  icon: React.ReactNode; right?: React.ReactNode; hint?: string; hintColor?: string; children: React.ReactNode;
}) {
  return (
    <View style={styles.inputContainer}>
      <View style={styles.inputWrapper}>
        {icon}
        {children}
        {right}
      </View>
      {hint ? <Text style={[styles.helperText, hintColor ? { color: hintColor } : null]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  gradient: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 20, maxWidth: 480, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', marginBottom: 22 },
  logoImage: { width: 76, height: 76, borderRadius: 20, marginBottom: 10 },
  title: { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  stepIcon: {
    width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.accentGlow, marginBottom: 14,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 4 },
  cardSub: { fontSize: 14, lineHeight: 20, color: C.textSecondary, marginBottom: 18 },
  strong: { color: C.text, fontWeight: '700' },
  banner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 14,
  },
  bannerError: { borderColor: `${C.error}55`, backgroundColor: `${C.error}14` },
  bannerInfo: { borderColor: `${C.success}55`, backgroundColor: `${C.success}12` },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 18, color: C.text },
  inputContainer: { marginBottom: 12 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.backgroundSecondary, borderRadius: 14,
    paddingHorizontal: 14, borderWidth: 1, borderColor: C.border, gap: 10,
  },
  input: { flex: 1, minWidth: 0, fontSize: 16, color: C.text, paddingVertical: 15 },
  helperText: { marginTop: 5, fontSize: 12, color: C.textTertiary, marginLeft: 4 },
  forgotLink: { alignSelf: 'flex-end', marginBottom: 6, marginTop: -2, paddingVertical: 4 },
  linkText: { fontSize: 14, fontWeight: '700', color: C.accent },
  linkInline: { color: C.accent, fontWeight: '700' },
  primaryButton: { borderRadius: 16, overflow: 'hidden', marginTop: 6 },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 18, gap: 10 },
  primaryButtonText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  secondaryButton: { alignItems: 'center', paddingVertical: 14 },
  secondaryText: { fontSize: 15, fontWeight: '700', color: C.accent },
  tips: { gap: 6, marginTop: 2, marginBottom: 6 },
  tip: { fontSize: 13, lineHeight: 19, color: C.textSecondary },
  backLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, paddingVertical: 6 },
  backLinkText: { fontSize: 14, fontWeight: '600', color: C.textSecondary },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 18, gap: 6, flexWrap: 'wrap' },
  switchText: { fontSize: 14, color: C.textSecondary },
  doneBox: { alignItems: 'center', gap: 12, paddingVertical: 18 },
  doneText: { fontSize: 15, fontWeight: '600', color: C.text, textAlign: 'center' },
  footerText: { marginTop: 16, paddingHorizontal: 8, fontSize: 12, lineHeight: 18, color: C.textTertiary, textAlign: 'center' },
  footerLink: { textDecorationLine: 'underline', fontWeight: '700' },
});
