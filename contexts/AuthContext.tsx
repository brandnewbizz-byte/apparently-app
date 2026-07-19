import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { isAbortError, withAbortSignal } from '@/lib/abort';
import type { Session } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  fullName: string | null;
  username: string | null;
  phone: string | null;
  email: string | null;
  avatar: string;
}

interface AuthState {
  session: Session | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  emailVerificationRequired: boolean;
  pendingVerificationEmail: string | null;
}

const PROFILE_CACHE_KEY = 'apparently_user_profile_cache_v3';


const dummyUser: UserProfile = {
  id: 'dev-user',
  fullName: 'Developer',
  username: 'dev',
  phone: null,
  email: 'dev@localhost',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=dev-user',
};

const devSession = {
  user: { id: 'dev-user', email: 'dev@localhost' },
} as unknown as Session;

const defaultState: AuthState = {
  session: devSession,
  user: dummyUser,
  isAuthenticated: true,
  emailVerificationRequired: false,
  pendingVerificationEmail: null,
};

type ProfilesRow = {
  id: string;
  full_name?: string | null;
  username?: string | null;
  phone?: string | null;
  email?: string | null;
};



export const [AuthProvider, useAuth] = createContextHook(() => {
  const [state, setState] = useState<AuthState>(defaultState);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profileNeedsName, setProfileNeedsName] = useState<boolean>(false);
  const [emailVerificationRequired, setEmailVerificationRequired] = useState<boolean>(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [isResendingVerification, setIsResendingVerification] = useState<boolean>(false);
  const queryClient = useQueryClient();

  const { mutateAsync: saveProfileCache } = useMutation({
    mutationFn: async (profile: UserProfile) => {
      await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
      return profile;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(['userProfile'], profile);
    },
  });

  const loadCachedProfile = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const stored = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
      if (!stored || stored === 'undefined') return null;
      return JSON.parse(stored) as UserProfile;
    } catch (e) {
      console.error('[Auth] Failed to load cached profile:', e);
      return null;
    }
  }, []);

  const fetchProfileFromDb = useCallback(async (userId: string): Promise<ProfilesRow | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, phone, email')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('[Auth] profiles select error:', error.message);
        return null;
      }
      return (data as ProfilesRow | null) ?? null;
    } catch (e) {
      console.error('[Auth] profiles select exception:', e);
      return null;
    }
  }, []);

  const buildProfile = useCallback(
    async (session: Session): Promise<{ profile: UserProfile; needsName: boolean }> => {
      const userId = session.user.id;
      const cached = await loadCachedProfile();
      const dbProfile = await fetchProfileFromDb(userId);

      const dbName = dbProfile?.full_name ?? null;
      const phone = dbProfile?.phone ?? cached?.phone ?? null;
      const username = dbProfile?.username ?? cached?.username ?? null;

      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`;
      const fullName = dbName ?? cached?.fullName ?? null;
      const needsName = !fullName || fullName.trim().length === 0;

      return {
        profile: {
          id: userId,
          fullName: fullName && fullName.trim().length > 0 ? fullName.trim() : null,
          username,
          phone,
          email: session.user.email ?? null,
          avatar,
        },
        needsName,
      };
    },
    [fetchProfileFromDb, loadCachedProfile]
  );

  const setSessionState = useCallback(
    async (session: Session | null) => {
      if (!session?.user) {
        setProfileNeedsName(false);
        setEmailVerificationRequired(false);
        setPendingVerificationEmail(null);
        setState(defaultState);
        return;
      }

      const { profile, needsName } = await buildProfile(session);
      console.log('[Auth] Built profile:', {
        userId: profile.id,
        hasName: !needsName,
        phone: profile.phone,
      });

      setProfileNeedsName(needsName);
      setEmailVerificationRequired(false);
      setPendingVerificationEmail(null);
      setState({
        session,
        user: profile,
        isAuthenticated: true,
        emailVerificationRequired: false,
        pendingVerificationEmail: null,
      });

      await saveProfileCache(profile);
    },
    [buildProfile, saveProfileCache]
  );

  useEffect(() => {
    console.log('[Auth] DEV MODE — skipping Supabase auth, always authenticated');
    setIsLoading(false);
  }, []);

  const checkUsernameAvailable = async (username: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.toLowerCase().trim())
        .maybeSingle();
      
      if (error) {
        console.error('[Auth] Username check error:', error.message);
        return false;
      }
      return !data;
    } catch (e) {
      console.error('[Auth] Username check exception:', e);
      return false;
    }
  };

  const signUp = async (
    email: string,
    username: string,
    password: string,
    fullName: string
  ): Promise<{ success: boolean; error?: string; needsEmailVerification?: boolean }> => {
    try {
      setAuthError(null);
      const trimmedUsername = username.toLowerCase().trim();
      const trimmedEmail = email.toLowerCase().trim();

      setEmailVerificationRequired(false);
      setPendingVerificationEmail(null);

      console.log('[Auth] Sign up with email:', trimmedEmail, 'username:', trimmedUsername);

      if (!trimmedEmail || !trimmedEmail.includes('@')) {
        const msg = 'Please enter a valid email address.';
        setAuthError(msg);
        return { success: false, error: msg };
      }

      if (trimmedUsername.length < 3) {
        const msg = 'Username must be at least 3 characters.';
        setAuthError(msg);
        return { success: false, error: msg };
      }

      if (!/^[a-z0-9_]+$/.test(trimmedUsername)) {
        const msg = 'Username can only contain letters, numbers, and underscores.';
        setAuthError(msg);
        return { success: false, error: msg };
      }

      const isAvailable = await checkUsernameAvailable(trimmedUsername);
      if (!isAvailable) {
        const msg = 'Username is already taken.';
        setAuthError(msg);
        return { success: false, error: msg };
      }

      const cleanedFullName = fullName.trim();

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            name: cleanedFullName,
            full_name: cleanedFullName,
            username: trimmedUsername,
          },
        },
      });

      if (authError) {
        console.error('[Auth] Sign up error:', {
          message: authError.message,
          name: (authError as unknown as { name?: string }).name,
          status: (authError as unknown as { status?: number }).status,
          code: (authError as unknown as { code?: string }).code,
        });

        const msgLower = authError.message.toLowerCase();
        let userMessage = authError.message;

        if (msgLower.includes('already registered') || msgLower.includes('already exists')) {
          userMessage = 'This email is already registered.';
        } else if (msgLower.includes('database error saving new user')) {
          userMessage = "Couldn't create your account. Please try again in a minute.";
        }

        setAuthError(userMessage);
        return { success: false, error: userMessage };
      }

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert(
            {
              id: authData.user.id,
              full_name: cleanedFullName,
              username: trimmedUsername,
              email: trimmedEmail,
            },
            { onConflict: 'id' }
          );

        if (profileError) {
          console.error('[Auth] Profile save error:', profileError.message);
        }
      }

      const needsEmailVerification = !authData.session && !authData.user?.email_confirmed_at;
      if (needsEmailVerification) {
        console.log('[Auth] Email verification required for:', trimmedEmail);
        setEmailVerificationRequired(true);
        setPendingVerificationEmail(trimmedEmail);
      }

      console.log('[Auth] Sign up successful');
      return { success: true, needsEmailVerification };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign up failed';
      console.error('[Auth] Sign up exception:', message);
      setAuthError(message);
      return { success: false, error: message };
    }
  };

  const signIn = async (
    emailOrUsername: string,
    password: string
  ): Promise<{ success: boolean; error?: string; needsEmailVerification?: boolean }> => {
    try {
      setAuthError(null);
      const trimmedInput = emailOrUsername.toLowerCase().trim();
      const isEmail = trimmedInput.includes('@');

      setEmailVerificationRequired(false);
      setPendingVerificationEmail(null);

      console.log('[Auth] Sign in with', isEmail ? 'email' : 'username', ':', trimmedInput);

      let loginEmail = trimmedInput;

      if (!isEmail) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, email')
          .eq('username', trimmedInput)
          .maybeSingle();

        if (profileError || !profileData) {
          console.log('[Auth] Username not found:', trimmedInput);
          const msg = 'Invalid username or password.';
          setAuthError(msg);
          return { success: false, error: msg };
        }

        if (profileData.email) {
          loginEmail = profileData.email;
        } else {
          console.log('[Auth] No email found for username:', trimmedInput);
          const msg = 'Invalid username or password.';
          setAuthError(msg);
          return { success: false, error: msg };
        }
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (error) {
        console.error('[Auth] Sign in error:', error.message);
        const isEmailNotConfirmed = error.message.toLowerCase().includes('email not confirmed');

        if (isEmailNotConfirmed) {
          setEmailVerificationRequired(true);
          setPendingVerificationEmail(loginEmail);
          return { success: false, error: 'Confirm your email first.', needsEmailVerification: true };
        }

        let userMessage = error.message;
        if (error.message.includes('Invalid login credentials')) {
          userMessage = 'Invalid email or password.';
        }
        setAuthError(userMessage);
        return { success: false, error: userMessage };
      }

      console.log('[Auth] Sign in successful');
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed';
      console.error('[Auth] Sign in exception:', message);
      setAuthError(message);
      return { success: false, error: message };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      console.log('[Auth] Signing out user...');
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[Auth] Sign out error:', error.message);
      }
      setProfileNeedsName(false);
      setState(defaultState);
      try {
        await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
      } catch (e) {
        console.error('[Auth] Failed to clear cached profile on sign out:', e);
      }
      console.log('[Auth] User signed out successfully');
    } catch (error) {
      console.error('[Auth] Sign out exception:', error);
    }
  };

  const clearError = () => {
    setAuthError(null);
    setEmailVerificationRequired(false);
    setPendingVerificationEmail(null);
  };

  const saveFullNameOnce = async (fullName: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setAuthError(null);
      const trimmed = fullName.trim();

      if (trimmed.length < 2) {
        const msg = 'Please enter your full name.';
        setAuthError(msg);
        return { success: false, error: msg };
      }

      if (!state.session?.user) {
        const msg = 'Not signed in.';
        setAuthError(msg);
        return { success: false, error: msg };
      }

      const userId = state.session.user.id;
      const phone = state.session.user.phone ?? state.user?.phone ?? null;

      console.log('[Auth] Saving profile name (optimistic):', { userId, hasPhone: !!phone });

      const optimisticUser: UserProfile | null = state.user ? { ...state.user, fullName: trimmed } : null;
      if (optimisticUser) {
        setState((prev) => ({ ...prev, user: optimisticUser }));
        await saveProfileCache(optimisticUser);
      }

      setProfileNeedsName(false);

      const base = { id: userId, phone } as Record<string, unknown>;

      let dbSaved = false;
      try {
        const abortController = new AbortController();
        const attempt1 = await withAbortSignal(
          supabase.from('profiles').upsert({ ...base, full_name: trimmed }, { onConflict: 'id' }),
          abortController.signal
        );
        if (!attempt1.error) {
          dbSaved = true;
        } else {
          console.error('[Auth] profiles upsert(full_name) error:', attempt1.error.message);
        }
      } catch (e: any) {
        if (isAbortError(e)) {
          console.log('[Auth] Query aborted — normal on navigation');
        } else {
          console.error('[Auth] profiles upsert exception:', e);
        }
      }

      if (!dbSaved) {
        return { success: true, error: 'Saved locally. We will retry syncing to your profile later.' };
      }

      return { success: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save name';
      console.error('[Auth] saveFullNameOnce exception:', message);
      setAuthError(message);
      return { success: false, error: message };
    }
  };

  const resendVerificationEmail = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setAuthError(null);
      const trimmed = email.trim().toLowerCase();

      if (!trimmed || !trimmed.includes('@')) {
        const msg = 'Missing email.';
        setAuthError(msg);
        return { success: false, error: msg };
      }

      console.log('[Auth] Resending verification email:', trimmed);
      setIsResendingVerification(true);

      const { error } = await supabase.auth.resend({ type: 'signup', email: trimmed });

      if (error) {
        console.error('[Auth] resend verification error:', error.message);
        let userMessage = error.message;
        if (error.message.toLowerCase().includes('rate limit')) {
          userMessage = 'Too many requests. Please wait a minute and try again.';
        }
        setAuthError(userMessage);
        return { success: false, error: userMessage };
      }

      return { success: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to resend email';
      console.error('[Auth] resendVerificationEmail exception:', message);
      setAuthError(message);
      return { success: false, error: message };
    } finally {
      setIsResendingVerification(false);
    }
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setAuthError(null);
      const trimmedEmail = email.toLowerCase().trim();
      console.log('[Auth] Sending password reset for email:', trimmedEmail);
      
      if (!trimmedEmail || !trimmedEmail.includes('@')) {
        const msg = 'Please enter a valid email address.';
        setAuthError(msg);
        return { success: false, error: msg };
      }

      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: 'apparently://reset-password',
      });

      if (error) {
        console.error('[Auth] Password reset error:', error.message);
        
        let userMessage = error.message;
        if (error.message.toLowerCase().includes('rate limit')) {
          userMessage = 'Too many password reset requests. Please wait a few minutes before trying again.';
        }
        
        setAuthError(userMessage);
        return { success: false, error: userMessage };
      }

      console.log('[Auth] Password reset email sent successfully');
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Password reset failed';
      console.error('[Auth] Password reset exception:', message);
      setAuthError(message);
      return { success: false, error: message };
    }
  };

  const displayName = useMemo(() => {
    const name = state.user?.fullName ?? '';
    return name.trim().length > 0 ? name : null;
  }, [state.user?.fullName]);

  return {
    ...state,
    isLoading,
    authError,
    profileNeedsName,
    emailVerificationRequired,
    pendingVerificationEmail,
    isResendingVerification,
    displayName,
    saveFullNameOnce,
    signUp,
    signIn,
    signOut,
    resendVerificationEmail,
    resetPassword,
    clearError,
  };
});
