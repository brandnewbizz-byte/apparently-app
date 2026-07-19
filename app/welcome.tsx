import { Sparkles, ArrowRight, User, Lock, AtSign, AlertCircle, Eye, EyeOff, Mail } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';

type AuthMode = 'login' | 'signup' | 'forgot';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const {
    signIn,
    signUp,
    authError,
    clearError,
    emailVerificationRequired,
    pendingVerificationEmail,
    resendVerificationEmail,
    isResendingVerification,
    resetPassword,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [resetSent, setResetSent] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const formFadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(formFadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(formFadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [formFadeAnim, mode]);

  const isLoginValid = useMemo(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(username.trim()) && password.length >= 6;
  }, [username, password]);

  const isSignupValid = useMemo(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return (
      fullName.trim().length >= 2 &&
      emailRegex.test(email.trim()) &&
      username.trim().length >= 3 &&
      password.length >= 6 &&
      confirmPassword === password
    );
  }, [fullName, email, username, password, confirmPassword]);

  const isForgotValid = useMemo(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(forgotEmail.trim());
  }, [forgotEmail]);

  const errorMessage = localError || authError;

  const shouldShowEmailBanner = useMemo(() => {
    return emailVerificationRequired && !!pendingVerificationEmail;
  }, [emailVerificationRequired, pendingVerificationEmail]);

  const handleLogin = async () => {
    console.log('[Welcome] handleLogin');

    if (isSubmitting) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (!isLoginValid) {
      setLocalError('Please enter a valid username and password.');
      return;
    }

    setIsSubmitting(true);
    setLocalError(null);
    clearError();

    try {
      const res = await signIn(username.trim(), password);
      console.log('[Welcome] signIn result:', res);

      if (!res.success) {
        const msg = res.error || 'Login failed';
        setLocalError(msg);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Login failed';
      console.error('[Welcome] handleLogin exception:', msg);
      setLocalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async () => {
    console.log('[Welcome] handleSignup');

    if (isSubmitting) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (!isSignupValid) {
      setLocalError('Please fill in all fields correctly.');
      return;
    }

    setIsSubmitting(true);
    setLocalError(null);
    clearError();

    try {
      const res = await signUp(
        email.trim(),
        username.trim(),
        password,
        fullName.trim()
      );
      console.log('[Welcome] signUp result:', res);

      if (!res.success) {
        const msg = res.error || 'Signup failed';
        setLocalError(msg);
      } else {
        Alert.alert('Success', 'Account created! You are now signed in.');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Signup failed';
      console.error('[Welcome] handleSignup exception:', msg);
      setLocalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModeSwitch = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setMode(mode === 'login' ? 'signup' : 'login');
    setLocalError(null);
    clearError();
    setResetSent(false);
  };

  const handleForgotPassword = async () => {
    if (isSubmitting || !isForgotValid) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setIsSubmitting(true);
    setLocalError(null);
    clearError();

    try {
      const res = await resetPassword(forgotEmail.trim());
      if (!res.success) {
        setLocalError(res.error || 'Failed to send reset email');
      } else {
        setResetSent(true);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to send reset email';
      setLocalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.dark.background, Colors.dark.backgroundSecondary, Colors.dark.background]} style={styles.gradient}>
        <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              style={[
                styles.heroSection,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <View style={styles.logoContainer}>
                <LinearGradient
                  colors={[Colors.dark.gradient1, Colors.dark.gradient2]}
                  style={styles.logoGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Sparkles size={48} color="#FFFFFF" strokeWidth={2} />
                </LinearGradient>
              </View>

              <Text style={styles.title}>Apparently</Text>
              <Text style={styles.subtitle}>
                {mode === 'login' ? 'Welcome back!' : 'Create your account'}
              </Text>
            </Animated.View>

            <Animated.View style={[styles.formSection, { opacity: formFadeAnim }]}>
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>
                  {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Sign Up' : 'Reset Password'}
                </Text>
                <Text style={styles.formSubtitle}>
                  {mode === 'login'
                    ? 'Enter your credentials to continue'
                    : mode === 'signup'
                    ? 'Fill in your details to get started'
                    : 'Enter your email to receive a reset link'}
                </Text>

                {shouldShowEmailBanner ? (
                  <View style={styles.emailBanner} testID="email-verification-banner">
                    <View style={styles.emailBannerHeader}>
                      <AlertCircle size={16} color={Colors.dark.warning} />
                      <Text style={styles.emailBannerTitle}>Confirm your email first</Text>
                    </View>
                    <Text style={styles.emailBannerSubtitle} numberOfLines={2}>
                      We sent a verification link to {pendingVerificationEmail}.
                    </Text>
                    <TouchableOpacity
                      style={[styles.resendButton, isResendingVerification && styles.resendButtonDisabled]}
                      disabled={isResendingVerification}
                      onPress={async () => {
                        if (!pendingVerificationEmail) return;
                        try {
                          const res = await resendVerificationEmail(pendingVerificationEmail);
                          if (!res.success) {
                            Alert.alert('Error', res.error || 'Could not resend email');
                            return;
                          }
                          Alert.alert('Sent', 'Verification email resent.');
                        } catch (e) {
                          const msg = e instanceof Error ? e.message : 'Could not resend email';
                          Alert.alert('Error', msg);
                        }
                      }}
                      activeOpacity={0.85}
                      testID="resend-verification-button"
                    >
                      {isResendingVerification ? (
                        <ActivityIndicator color={Colors.dark.text} />
                      ) : (
                        <Text style={styles.resendButtonText}>Resend email</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null}

                {errorMessage ? (
                  <View style={styles.errorContainer}>
                    <AlertCircle size={16} color={Colors.dark.error} />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                ) : null}

                {mode === 'forgot' ? (
                  <>
                    {resetSent ? (
                      <View style={styles.successContainer}>
                        <Text style={styles.successText}>
                          Password reset link sent! Check your email inbox.
                        </Text>
                        <TouchableOpacity
                          style={styles.backToLoginButton}
                          onPress={() => {
                            setMode('login');
                            setResetSent(false);
                            setForgotEmail('');
                          }}
                        >
                          <Text style={styles.backToLoginText}>Back to Sign In</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.inputContainer}>
                        <View style={styles.inputWrapper}>
                          <Mail size={20} color={Colors.dark.textTertiary} />
                          <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor={Colors.dark.textTertiary}
                            value={forgotEmail}
                            onChangeText={setForgotEmail}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="email-address"
                            textContentType="emailAddress"
                            autoComplete="email"
                            testID="forgot-email-input"
                          />
                        </View>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    {mode === 'signup' && (
                      <>
                        <View style={styles.inputContainer}>
                          <View style={styles.inputWrapper}>
                            <User size={20} color={Colors.dark.textTertiary} />
                            <TextInput
                              style={styles.input}
                              placeholder="Full Name"
                              placeholderTextColor={Colors.dark.textTertiary}
                              value={fullName}
                              onChangeText={setFullName}
                              autoCapitalize="words"
                              textContentType="name"
                              autoComplete="name"
                              testID="fullname-input"
                            />
                          </View>
                        </View>

                        <View style={styles.inputContainer}>
                          <View style={styles.inputWrapper}>
                            <Mail size={20} color={Colors.dark.textTertiary} />
                            <TextInput
                              style={styles.input}
                              placeholder="Email"
                              placeholderTextColor={Colors.dark.textTertiary}
                              value={email}
                              onChangeText={setEmail}
                              autoCapitalize="none"
                              autoCorrect={false}
                              keyboardType="email-address"
                              textContentType="emailAddress"
                              autoComplete="email"
                              testID="email-input"
                            />
                          </View>
                          <Text style={styles.helperText}>Used for login and password recovery</Text>
                        </View>
                      </>
                    )}

                    {mode === 'login' ? (
                      <View style={styles.inputContainer}>
                        <View style={styles.inputWrapper}>
                          <Mail size={20} color={Colors.dark.textTertiary} />
                          <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor={Colors.dark.textTertiary}
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="email-address"
                            textContentType="emailAddress"
                            autoComplete="email"
                            testID="email-login-input"
                          />
                        </View>
                      </View>
                    ) : (
                      <View style={styles.inputContainer}>
                        <View style={styles.inputWrapper}>
                          <AtSign size={20} color={Colors.dark.textTertiary} />
                          <TextInput
                            style={styles.input}
                            placeholder="Username"
                            placeholderTextColor={Colors.dark.textTertiary}
                            value={username}
                            onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                            autoCapitalize="none"
                            autoCorrect={false}
                            textContentType="username"
                            autoComplete="username"
                            testID="username-input"
                          />
                        </View>
                        <Text style={styles.helperText}>Letters, numbers, and underscores only</Text>
                      </View>
                    )}

                    <View style={styles.inputContainer}>
                      <View style={styles.inputWrapper}>
                        <Lock size={20} color={Colors.dark.textTertiary} />
                        <TextInput
                          style={styles.input}
                          placeholder="Password"
                          placeholderTextColor={Colors.dark.textTertiary}
                          value={password}
                          onChangeText={setPassword}
                          secureTextEntry={!showPassword}
                          textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                          testID="password-input"
                        />
                        <TouchableOpacity
                          onPress={() => setShowPassword(!showPassword)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          {showPassword ? (
                            <EyeOff size={20} color={Colors.dark.textTertiary} />
                          ) : (
                            <Eye size={20} color={Colors.dark.textTertiary} />
                          )}
                        </TouchableOpacity>
                      </View>
                      {mode === 'signup' && (
                        <Text style={styles.helperText}>At least 6 characters</Text>
                      )}
                    </View>

                    {mode === 'signup' && (
                      <View style={styles.inputContainer}>
                        <View style={styles.inputWrapper}>
                          <Lock size={20} color={Colors.dark.textTertiary} />
                          <TextInput
                            style={styles.input}
                            placeholder="Confirm Password"
                            placeholderTextColor={Colors.dark.textTertiary}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showConfirmPassword}
                            textContentType="newPassword"
                            autoComplete="new-password"
                            testID="confirm-password-input"
                          />
                          <TouchableOpacity
                            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            {showConfirmPassword ? (
                              <EyeOff size={20} color={Colors.dark.textTertiary} />
                            ) : (
                              <Eye size={20} color={Colors.dark.textTertiary} />
                            )}
                          </TouchableOpacity>
                        </View>
                        {confirmPassword.length > 0 && confirmPassword !== password && (
                          <Text style={styles.errorHelperText}>Passwords do not match</Text>
                        )}
                      </View>
                    )}

                    {mode === 'login' && (
                      <TouchableOpacity
                        style={styles.forgotPasswordLink}
                        onPress={() => {
                          setMode('forgot');
                          setLocalError(null);
                          clearError();
                        }}
                        testID="forgot-password-link"
                      >
                        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}

                {mode !== 'forgot' || !resetSent ? (
                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      ((mode === 'login' && !isLoginValid) || 
                       (mode === 'signup' && !isSignupValid) || 
                       (mode === 'forgot' && !isForgotValid) ||
                       isSubmitting) &&
                        styles.primaryButtonDisabled,
                    ]}
                    onPress={mode === 'login' ? handleLogin : mode === 'signup' ? handleSignup : handleForgotPassword}
                    disabled={
                      (mode === 'login' && !isLoginValid) || 
                      (mode === 'signup' && !isSignupValid) || 
                      (mode === 'forgot' && !isForgotValid) ||
                      isSubmitting
                    }
                    activeOpacity={0.85}
                    testID={mode === 'login' ? 'login-button' : mode === 'signup' ? 'signup-button' : 'reset-button'}
                  >
                    <LinearGradient
                      colors={[Colors.dark.accent, Colors.dark.gradient2]}
                      style={styles.primaryGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <Text style={styles.primaryButtonText}>
                            {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
                          </Text>
                          <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                ) : null}

                {mode !== 'forgot' ? (
                  <View style={styles.switchModeContainer}>
                    <Text style={styles.switchModeText}>
                      {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
                    </Text>
                    <TouchableOpacity onPress={handleModeSwitch} testID="switch-mode-button">
                      <Text style={styles.switchModeLink}>
                        {mode === 'login' ? 'Sign Up' : 'Sign In'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.switchModeContainer}>
                    <TouchableOpacity onPress={() => { setMode('login'); setResetSent(false); }} testID="back-to-login-button">
                      <Text style={styles.switchModeLink}>Back to Sign In</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <Text style={styles.footerText}>
                By continuing, you agree to our Terms of Service and Privacy Policy.
              </Text>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  gradient: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    marginBottom: 18,
  },
  logoGradient: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.dark.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  title: {
    fontSize: 34,
    fontWeight: '800' as const,
    color: Colors.dark.text,
    letterSpacing: -1,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
  },
  formSection: {
    flex: 1,
  },
  formCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.dark.text,
    marginBottom: 6,
  },
  formSubtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 16,
  },
  emailBanner: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${Colors.dark.warning}55`,
    backgroundColor: `${Colors.dark.warning}1A`,
    padding: 14,
    marginBottom: 14,
  },
  emailBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  emailBannerTitle: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: Colors.dark.text,
  },
  emailBannerSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.dark.textSecondary,
    marginBottom: 10,
  },
  resendButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: `${Colors.dark.warning}33`,
    borderWidth: 1,
    borderColor: `${Colors.dark.warning}55`,
  },
  resendButtonDisabled: {
    opacity: 0.7,
  },
  resendButtonText: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: Colors.dark.text,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${Colors.dark.error}55`,
    backgroundColor: `${Colors.dark.error}22`,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.text,
    lineHeight: 18,
  },
  inputContainer: {
    marginBottom: 14,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: Colors.dark.text,
    paddingVertical: 16,
  },
  helperText: {
    marginTop: 6,
    fontSize: 12,
    color: Colors.dark.textTertiary,
    marginLeft: 4,
  },
  errorHelperText: {
    marginTop: 6,
    fontSize: 12,
    color: Colors.dark.error,
    marginLeft: 4,
  },
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: Colors.dark.accent,
    fontWeight: '600' as const,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successText: {
    fontSize: 15,
    color: Colors.dark.success,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  backToLoginButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  backToLoginText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 10,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  switchModeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    gap: 6,
  },
  switchModeText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  switchModeLink: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.dark.accent,
  },
  footerText: {
    marginTop: 16,
    paddingHorizontal: 8,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.dark.textTertiary,
    textAlign: 'center',
  },
});
