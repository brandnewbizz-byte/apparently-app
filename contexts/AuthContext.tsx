import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { File as ExpoFile } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';
import { isAbortError, withAbortSignal } from '@/lib/abort';
import { isLocalFileUri } from '@/lib/media';
import { sanitizeBio, sanitizeFullName, sanitizeLocation } from '@/lib/sanitize';
import type { Session } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

interface UserProfile {
  id: string;
  fullName: string | null;
  username: string | null;
  bio: string | null;
  location: string | null;
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


// UNAUTHENTICATED default — never assume a session on mount.
// The useEffect calls getSession() + onAuthStateChange to determine real auth state.
const defaultState: AuthState = {
  session: null,
  user: null,
  isAuthenticated: false,
  emailVerificationRequired: false,
  pendingVerificationEmail: null,
};

type ProfilesRow = {
  id: string;
  full_name?: string | null;
  username?: string | null;
  phone?: string | null;
  email?: string | null;
  bio?: string | null;
  location?: string | null;
  avatar?: string | null;
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
      logger.error('Auth', 'Failed to load cached profile', { e });
      return null;
    }
  }, []);

  const fetchProfileFromDb = useCallback(async (userId: string): Promise<ProfilesRow | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, phone, email, avatar, bio, location')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        logger.error('Auth', 'profiles select error', { message: error.message });
        return null;
      }
      return (data as ProfilesRow | null) ?? null;
    } catch (e) {
      logger.error('Auth', 'profiles select exception', { e });
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!state.session?.user) return;
    const userId = state.session.user.id;
    const dbProfile = await fetchProfileFromDb(userId);
    if (!dbProfile || !state.user) return;
    const updated: UserProfile = {
      ...state.user,
      fullName: dbProfile.full_name ?? state.user.fullName,
      username: dbProfile.username ?? state.user.username,
      bio: dbProfile.bio ?? state.user.bio,
      location: dbProfile.location ?? state.user.location,
      avatar: dbProfile.avatar || state.user.avatar,
      phone: dbProfile.phone ?? state.user.phone,
    };
    setState((prev) => ({ ...prev, user: updated }));
    await saveProfileCache(updated);
  }, [state.session?.user?.id, state.user, fetchProfileFromDb, saveProfileCache]);

  const buildProfile = useCallback(
    async (session: Session): Promise<{ profile: UserProfile; needsName: boolean }> => {
      const userId = session.user.id;
      const cached = await loadCachedProfile();
      const dbProfile = await fetchProfileFromDb(userId);

      const dbName = dbProfile?.full_name ?? null;
      const phone = dbProfile?.phone ?? cached?.phone ?? null;
      const username = dbProfile?.username ?? cached?.username ?? null;
      const bio = dbProfile?.bio ?? cached?.bio ?? null;
      const location = dbProfile?.location ?? cached?.location ?? null;

      // Use DB avatar if set, then cached avatar, fallback to DiceBear
      const dbAvatar = dbProfile?.avatar || null;
      const cachedAvatar = cached?.avatar || null;
      const diceBearAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`;
      const avatar = dbAvatar || cachedAvatar || diceBearAvatar;
      const fullName = dbName ?? cached?.fullName ?? null;
      const needsName = !fullName || fullName.trim().length === 0;

      return {
        profile: {
          id: userId,
          fullName: fullName && fullName.trim().length > 0 ? fullName.trim() : null,
          username,
          bio,
          location,
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
      logger.info('Auth', 'Built profile', {
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
    setIsLoading(true);

    // Listen for auth state changes (login, logout, session refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        logger.info('Auth', 'Auth state changed', { event, hasSession: !!session });
        if (session) {
          await setSessionState(session);
        } else {
          setProfileNeedsName(false);
          setEmailVerificationRequired(false);
          setPendingVerificationEmail(null);
          setState({
            session: null,
            user: null,
            isAuthenticated: false,
            emailVerificationRequired: false,
            pendingVerificationEmail: null,
          });
        }
        setIsLoading(false);
      }
    );

    // Get initial session (already logged in from previous session)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionState(session).finally(() => setIsLoading(false));
      } else {
        // No session — set unauthenticated immediately
        setState({
          session: null,
          user: null,
          isAuthenticated: false,
          emailVerificationRequired: false,
          pendingVerificationEmail: null,
        });
        setIsLoading(false);
      }
    }).catch((e) => {
      logger.error('Auth', 'getSession failed', { message: e?.message });
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkUsernameAvailable = async (username: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.toLowerCase().trim())
        .maybeSingle();
      
      if (error) {
        logger.error('Auth', 'Username check error', { message: error.message });
        return false;
      }
      return !data;
    } catch (e) {
      logger.error('Auth', 'Username check exception', { e });
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

      logger.info('Auth', 'Sign up with email', { trimmedEmail, trimmedUsername });

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

      const cleanedFullName = sanitizeFullName(fullName);

      if (!cleanedFullName) {
        const msg = 'Please enter your name.';
        setAuthError(msg);
        return { success: false, error: msg };
      }

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
        logger.error('Auth', 'Sign up error', {
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
          logger.error('Auth', 'Profile save error', { message: profileError.message });
        }


      }

      const needsEmailVerification = !authData.session && !authData.user?.email_confirmed_at;
      if (needsEmailVerification) {
        logger.info('Auth', 'Email verification required for', { trimmedEmail });
        setEmailVerificationRequired(true);
        setPendingVerificationEmail(trimmedEmail);
      }

      logger.info('Auth', 'Sign up successful');
      return { success: true, needsEmailVerification };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign up failed';
      logger.error('Auth', 'Sign up exception', { message });
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

      logger.info('Auth', 'Sign in with', { value: isEmail ? 'email' : 'username', trimmedInput });

      let loginEmail = trimmedInput;

      if (!isEmail) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, email')
          .eq('username', trimmedInput)
          .maybeSingle();

        if (profileError || !profileData) {
          logger.info('Auth', 'Username not found', { trimmedInput });
          const msg = 'Invalid username or password.';
          setAuthError(msg);
          return { success: false, error: msg };
        }

        if (profileData.email) {
          loginEmail = profileData.email;
        } else {
          logger.info('Auth', 'No email found for username', { trimmedInput });
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
        logger.error('Auth', 'Sign in error', { message: error.message });
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

      logger.info('Auth', 'Sign in successful');
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed';
      logger.error('Auth', 'Sign in exception', { message });
      setAuthError(message);
      return { success: false, error: message };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      logger.info('Auth', 'Signing out user...');
      const { error } = await supabase.auth.signOut();
      if (error) {
        logger.error('Auth', 'Sign out error', { message: error.message });
      }
      setProfileNeedsName(false);
      setEmailVerificationRequired(false);
      setPendingVerificationEmail(null);
      setState({
        session: null,
        user: null,
        isAuthenticated: false,
        emailVerificationRequired: false,
        pendingVerificationEmail: null,
      });
      try {
        await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
      } catch (e) {
        logger.error('Auth', 'Failed to clear cached profile on sign out', { e });
      }
      logger.info('Auth', 'User signed out successfully');
    } catch (error) {
      logger.error('Auth', 'Sign out exception', { error });
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

      logger.info('Auth', 'Saving profile name (optimistic)', { userId, hasPhone: !!phone });

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
        // Save to profiles table (used by AuthContext)
        const profileResult = await withAbortSignal(
          supabase.from('profiles').upsert({ ...base, full_name: trimmed }, { onConflict: 'id' }),
          abortController.signal
        );
        if (!profileResult.error) {
          dbSaved = true;
        } else {
          logger.error('Auth', 'profiles upsert(full_name) error', { error: profileResult.error?.message });
        }
      } catch (e: any) {
        if (isAbortError(e)) {
          logger.info('Auth', 'Query aborted — normal on navigation');
        } else {
          logger.error('Auth', 'profiles/users upsert exception', { e });
        }
      }

      if (!dbSaved) {
        return { success: true, error: 'Saved locally. We will retry syncing to your profile later.' };
      }

      return { success: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save name';
      logger.error('Auth', 'saveFullNameOnce exception', { message });
      setAuthError(message);
      return { success: false, error: message };
    }
  };

  const updateAvatar = async (imageUri: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setAuthError(null);

      // ── Guard: reject local file paths before anything else ──
      if (isLocalFileUri(imageUri)) {
        // If it's a file:// URI, read it as base64 to convert to data URI.
        // The raw file path must never reach Supabase.
        // We'll handle this below in the read step.
        logger.info('Auth', 'Avatar from local file — will convert to base64', { imageUri: imageUri.substring(0, 40) });
      }

      if (!state.session?.user) {
        const msg = 'Not signed in.';
        setAuthError(msg);
        return { success: false, error: msg };
      }

      const userId = state.session.user.id;
      logger.info('Auth', 'Updating avatar', { userId });

      // ── Step 1: Read + validate + compress image ──
      let base64Data: string;
      try {
        if (isLocalFileUri(imageUri)) {
          // Convert file:// → data URI via expo-file-system
          base64Data = await new ExpoFile(imageUri).base64();
        } else if (imageUri.startsWith('data:image/')) {
          // Already a data URI — extract base64 part
          const commaIdx = imageUri.indexOf(',');
          base64Data = commaIdx > -1 ? imageUri.substring(commaIdx + 1) : imageUri;
        } else {
          // Remote URL — should not happen for uploads, but handle gracefully
          logger.warn('Auth', 'updateAvatar called with remote URL — skipping upload', { imageUri: imageUri.substring(0, 60) });
          return { success: false, error: 'Cannot upload from a remote URL. Please select a photo from your device.' };
        }
      } catch (readErr) {
        logger.error('Auth', 'Failed to read image file', { readErr });
        return { success: false, error: 'Failed to read the selected image. Please try again.' };
      }

      // ── Step 2: Compress via expo-image-manipulator before upload ──
      let dataUri: string;
      try {
        // Use manipulateAsync for resize if the URI is file:// based
        if (isLocalFileUri(imageUri)) {
          const result = await manipulateAsync(
            imageUri,
            [{ resize: { width: 600 } }], // max 600px wide — avatars are small
            { compress: 0.7, format: SaveFormat.JPEG }
          );
          const compressedBase64 = await new ExpoFile(result.uri).base64();
          dataUri = `data:image/jpeg;base64,${compressedBase64}`;
        } else {
          const ext = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
          const mimeMap: Record<string, string> = {
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            webp: 'image/webp',
          };
          const mimeType = mimeMap[ext] || 'image/jpeg';
          dataUri = `data:${mimeType};base64,${base64Data}`;
        }
        logger.info('Auth', 'Avatar compressed', { uriLen: dataUri.length });
      } catch (compressErr) {
        // Compression failed — use original base64 as fallback
        logger.warn('Auth', 'Image compression failed, using original', { compressErr });
        const ext = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        dataUri = `data:${mimeType};base64,${base64Data}`;
      }

      // ── Final guard: ensure we're not persisting a file:// path ──
      if (isLocalFileUri(dataUri)) {
        logger.error('Auth', 'CRITICAL: dataUri is still a local path — blocked');
        return { success: false, error: 'Failed to process the image. Please try again.' };
      }

      // ── Step 3: Optimistic update ──
      const optimisticUser: UserProfile | null = state.user
        ? { ...state.user, avatar: dataUri }
        : null;
      if (optimisticUser) {
        setState((prev) => ({ ...prev, user: optimisticUser }));
        await saveProfileCache(optimisticUser);
      }

      // ── Step 4: Persist to Supabase with retries ──
      let dbSaved = false;
      const MAX_RETRIES = 3;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const abortController = new AbortController();
          const profileResult = await withAbortSignal(
            supabase
              .from('profiles')
              .upsert({ id: userId, avatar: dataUri }, { onConflict: 'id' }),
            abortController.signal
          );
          if (!profileResult.error) {
            dbSaved = true;
            logger.info('Auth', 'Avatar saved to profiles', { userId, attempt });
            break;
          }
          logger.error('Auth', `profiles upsert attempt ${attempt} failed`, { error: profileResult.error?.message });
        } catch (e: any) {
          if (isAbortError(e)) {
            logger.info('Auth', 'Avatar upsert aborted');
            break;
          }
          logger.error('Auth', `profiles upsert attempt ${attempt} exception`, { e });
        }
        if (attempt < MAX_RETRIES) {
          // Exponential backoff: 1s, 2s, 4s
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
        }
      }

      if (!dbSaved) {
        return {
          success: true,
          error: 'Saved locally. We\'ll retry syncing to your profile later.',
        };
      }

      return { success: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to update avatar';
      logger.error('Auth', 'updateAvatar exception', { message });
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

      logger.info('Auth', 'Resending verification email', { trimmed });
      setIsResendingVerification(true);

      const { error } = await supabase.auth.resend({ type: 'signup', email: trimmed });

      if (error) {
        logger.error('Auth', 'resend verification error', { message: error.message });
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
      logger.error('Auth', 'resendVerificationEmail exception', { message });
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
      logger.info('Auth', 'Sending password reset for email', { trimmedEmail });
      
      if (!trimmedEmail || !trimmedEmail.includes('@')) {
        const msg = 'Please enter a valid email address.';
        setAuthError(msg);
        return { success: false, error: msg };
      }

      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: 'apparently://reset-password',
      });

      if (error) {
        logger.error('Auth', 'Password reset error', { message: error.message });
        
        let userMessage = error.message;
        if (error.message.toLowerCase().includes('rate limit')) {
          userMessage = 'Too many password reset requests. Please wait a few minutes before trying again.';
        }
        
        setAuthError(userMessage);
        return { success: false, error: userMessage };
      }

      logger.info('Auth', 'Password reset email sent successfully');
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Password reset failed';
      logger.error('Auth', 'Password reset exception', { message });
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
    updateAvatar,
    refreshProfile,
    signUp,
    signIn,
    signOut,
    resendVerificationEmail,
    resetPassword,
    clearError,
  };
});
