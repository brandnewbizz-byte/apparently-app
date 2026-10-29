import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { File as ExpoFile } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';
import { isAbortError, withAbortSignal } from '@/lib/abort';
import { isLocalFileUri } from '@/lib/media';
import { usernameProblem } from '@/constants/app';
import { generateUsername, sanitizeBio, sanitizeFullName, sanitizeLocation } from '@/lib/sanitize';
import { syncUserAvatar } from '@/lib/avatar-sync';
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
/** Where the sign-up email's link lands: a plain "you're confirmed, go back to the app" page. */
const EMAIL_CONFIRMED_URL = 'https://apparentlyappdashboard.nationalcompliancehub.com/confirmed';

/** Turn Supabase Auth errors into something a person can act on. */
export function friendlyAuthError(raw: string | undefined | null): string {
  const m = String(raw || '');
  const lower = m.toLowerCase();
  const wait = m.match(/after (\d+) seconds?/i);
  if (wait) return `Please wait ${wait[1]} seconds and try again.`;
  if (lower.includes('rate limit') || lower.includes('too many')) return 'Too many tries. Please wait a minute and try again.';
  if (lower.includes('invalid login credentials')) return 'Wrong email or password.';
  if (lower.includes('failed to fetch') || lower.includes('network request failed') || lower.includes('networkerror')) {
    return 'No connection. Check your internet and try again.';
  }
  if (lower.includes('token has expired') || lower.includes('otp_expired') || lower.includes('invalid otp')) {
    return 'That code is wrong or has expired. Ask for a new one.';
  }
  if (lower.includes('same_password') || lower.includes('different from the old password')) {
    return 'Choose a password you haven\'t used before.';
  }
  if (lower.includes('weak') || lower.includes('password should')) return m;
  return m || 'Something went wrong. Please try again.';
}


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
  const [isBlocked, setIsBlocked] = useState<boolean>(false);
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
      const { data, error } = await supabase.rpc('get_my_profile');

      if (error) {
        logger.error('Auth', 'profiles select error', { message: error.message });
        return null;
      }
      if (!data || (data as any).id !== userId) return null;
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
    if (!dbProfile) return;
    // Build updated profile from current state + DB values.
    // Fall back to a minimal user object if state.user is somehow null.
    const currentUser = state.user ?? {
      id: userId,
      fullName: null,
      username: null,
      bio: null,
      location: null,
      phone: null,
      email: null,
      avatar: '',
    };
    // For avatar: prefer DB value if it's a real URL (non-null, non-empty),
    // otherwise keep the current avatar.
    const dbAvatar = dbProfile.avatar;
    const resolvedAvatar = (dbAvatar && dbAvatar.length > 0) ? dbAvatar : currentUser.avatar;
    // Auto-assign a generic unique username if the account never chose one.
    let username = dbProfile.username ?? currentUser.username ?? null;
    if (!username || !username.trim()) {
      username = generateUsername(userId);
      supabase
        .from('profiles')
        .update({ username })
        .eq('id', userId)
        .then(({ error }) => {
          if (error) logger.error('Auth', 'username auto-assign update error', { message: error.message });
        });
    }
    const updated: UserProfile = {
      ...currentUser,
      fullName: dbProfile.full_name ?? currentUser.fullName,
      username,
      bio: dbProfile.bio ?? currentUser.bio,
      location: dbProfile.location ?? currentUser.location,
      avatar: resolvedAvatar,
      phone: dbProfile.phone ?? currentUser.phone,
    };
    setState((prev) => ({ ...prev, user: updated }));
    await saveProfileCache(updated);
  }, [state.session?.user?.id, state.user, fetchProfileFromDb, saveProfileCache]);

  const buildProfile = useCallback(
    async (session: Session): Promise<{ profile: UserProfile; needsName: boolean }> => {
      const userId = session.user.id;
      // Only trust the cache if it belongs to this account — otherwise a
      // previous user's bio/phone/avatar could leak into a new sign-in when the
      // old session expired without an explicit signOut().
      const rawCached = await loadCachedProfile();
      const cached = rawCached && rawCached.id === userId ? rawCached : null;
      const dbProfile = await fetchProfileFromDb(userId);

      const dbName = dbProfile?.full_name ?? null;
      const phone = dbProfile?.phone ?? cached?.phone ?? null;
      let username = dbProfile?.username ?? cached?.username ?? null;
      if (!username || !username.trim()) {
        username = generateUsername(userId);
        supabase
          .from('profiles')
          .update({ username })
          .eq('id', userId)
          .then(({ error }) => {
            if (error) logger.error('Auth', 'username auto-assign (build) update error', { message: error.message });
          });
      }
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

      // ENFORCE BLOCKED ACCOUNTS — a blocked account cannot continue.
      // Check the DB-backed flag (SECURITY DEFINER RPC) so a blocked user's
      // existing/refreshed session cannot bypass enforcement.
      try {
        const { data: blocked, error: blockedErr } = await supabase.rpc('is_user_blocked');
        if (!blockedErr && blocked === true) {
          logger.warn('Auth', 'Account is blocked — signing out', { userId: profile.id });
          setIsBlocked(true);
          await supabase.auth.signOut();
          setState(defaultState);
          return;
        }
      } catch (e) {
        logger.warn('Auth', 'Block check failed', { message: String(e) });
      }
      setIsBlocked(false);

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
    let cancelled = false;

    // Listen for auth state changes (initial session, login, logout, refresh).
    // INITIAL_SESSION fires once on subscribe, so no separate getSession() call
    // is needed (running both raced two profile builds against each other).
    //
    // IMPORTANT: the callback must not await other Supabase calls directly —
    // supabase-js holds its auth lock while invoking it, so awaiting rpc()/
    // from()/signOut() inside can deadlock and leave the app stuck on the
    // loading screen. Defer the work to the next tick instead.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        logger.info('Auth', 'Auth state changed', { event, hasSession: !!session });
        setTimeout(async () => {
          if (cancelled) return;
          try {
            if (session) {
              await setSessionState(session);
            } else {
              setProfileNeedsName(false);
              setEmailVerificationRequired(false);
              setPendingVerificationEmail(null);
              setState(defaultState);
            }
          } catch (e: any) {
            logger.error('Auth', 'Handling auth state change failed', { message: e?.message });
          } finally {
            if (!cancelled) setIsLoading(false);
          }
        }, 0);
      }
    );

    return () => {
      cancelled = true;
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

      const usernameError = usernameProblem(trimmedUsername);
      if (usernameError) {
        const msg = `Username: ${usernameError}`;
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
          emailRedirectTo: EMAIL_CONFIRMED_URL,
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
        let userMessage = friendlyAuthError(authError.message);

        if (msgLower.includes('already registered') || msgLower.includes('already exists')) {
          userMessage = 'An account with this email already exists. Sign in instead, or use "Forgot password".';
        } else if (msgLower.includes('database error saving new user')) {
          userMessage = "Couldn't create your account. Please try again in a minute.";
        }

        setAuthError(userMessage);
        return { success: false, error: userMessage };
      }

      // Supabase doesn't error when the email is already registered (so emails
      // can't be probed); it returns a user with no identities and sends NO
      // email. Without this check the app said "check your inbox" and nothing came.
      if (authData.user && Array.isArray(authData.user.identities) && authData.user.identities.length === 0) {
        const msg = 'An account with this email already exists. Sign in instead, or use "Forgot password" to reset it.';
        setAuthError(msg);
        return { success: false, error: msg };
      }

      if (authData.user && authData.session) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update(
            {
              full_name: cleanedFullName,
              username: trimmedUsername,
              email: trimmedEmail,
            }
          )
          .eq('id', authData.user.id);

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
  ): Promise<{ success: boolean; error?: string; needsEmailVerification?: boolean; email?: string }> => {
    try {
      setAuthError(null);
      const trimmedInput = emailOrUsername.toLowerCase().trim();
      const isEmail = trimmedInput.includes('@');

      setEmailVerificationRequired(false);
      setPendingVerificationEmail(null);

      logger.info('Auth', 'Sign in with', { value: isEmail ? 'email' : 'username', trimmedInput });

      if (!isEmail) {
        // Usernames are resolved on the server so nobody can look up another
        // person's email address (supabase/functions/username-login).
        const { data, error: fnError } = await supabase.functions.invoke('username-login', {
          body: { username: trimmedInput, password },
        });
        let payload: any = data;
        if (fnError) {
          // functions.invoke puts non-2xx bodies on error.context
          try { payload = await (fnError as any).context?.json?.(); } catch { payload = null; }
        }
        if (payload?.session?.access_token) {
          const { error: setErr } = await supabase.auth.setSession({
            access_token: payload.session.access_token,
            refresh_token: payload.session.refresh_token,
          });
          if (setErr) {
            const msg = friendlyAuthError(setErr.message);
            setAuthError(msg);
            return { success: false, error: msg };
          }
          logger.info('Auth', 'Sign in successful (username)');
          return { success: true };
        }
        if (payload?.error === 'email_not_confirmed' && payload.email) {
          setEmailVerificationRequired(true);
          setPendingVerificationEmail(payload.email);
          return { success: false, error: 'Confirm your email first.', needsEmailVerification: true, email: payload.email };
        }
        const msg = payload?.error === 'rate_limited'
          ? 'Too many tries. Please wait a minute and try again.'
          : payload?.error === 'invalid_credentials'
          ? 'Wrong username or password.'
          : friendlyAuthError((fnError as any)?.message || 'Could not sign in');
        setAuthError(msg);
        return { success: false, error: msg };
      }

      const loginEmail = trimmedInput;
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
          return { success: false, error: 'Confirm your email first.', needsEmailVerification: true, email: loginEmail };
        }

        const userMessage = friendlyAuthError(error.message);
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
      // Stop sending this account's pushes to this device once signed out
      // (must run while the session is still valid, before auth.signOut()).
      const signingOutId = state.session?.user?.id;
      if (signingOutId) {
        try {
          await supabase
            .from('profiles')
            .update({ push_token: null, push_token_updated_at: new Date().toISOString() })
            .eq('id', signingOutId);
        } catch (e) {
          logger.warn('Auth', 'Failed to clear push token on sign out', { e });
        }
      }
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
          supabase.from('profiles').update({ full_name: trimmed, phone }).eq('id', userId),
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
              .update({ avatar: dataUri })
              .eq('id', userId),
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

      // Propagate the new avatar to every denormalized snapshot
      syncUserAvatar(userId, dataUri);

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

      const { error } = await supabase.auth.resend({ type: 'signup', email: trimmed, options: { emailRedirectTo: EMAIL_CONFIRMED_URL } });

      if (error) {
        logger.error('Auth', 'resend verification error', { message: error.message });
        const userMessage = friendlyAuthError(error.message);
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

  /**
   * Confirm a new account with the code from the sign-up email. Works even when
   * the email's link can't open the app (or lands in a browser instead).
   */
  const verifyEmailCode = async (email: string, code: string): Promise<{ success: boolean; error?: string }> => {
    const trimmed = email.trim().toLowerCase();
    const token = code.replace(/\D/g, '');
    if (!trimmed || token.length < 6) return { success: false, error: 'Enter the code from the email.' };
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email: trimmed, token, type: 'signup' });
      if (error) {
        logger.warn('Auth', 'verify code failed', { message: error.message });
        const m = error.message.toLowerCase();
        const msg = m.includes('expired') || m.includes('invalid')
          ? 'That code is wrong or has expired. Tap "Send a new code".'
          : friendlyAuthError(error.message);
        return { success: false, error: msg };
      }
      if (data.session) {
        setPendingVerificationEmail(null);
        setEmailVerificationRequired(false);
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Could not check the code' };
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

      // The email carries a code for the app and a link to the web reset page.
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail);

      if (error) {
        logger.error('Auth', 'Password reset error', { message: error.message });
        const userMessage = friendlyAuthError(error.message);
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

  /** Finish a password reset in the app with the code from the email. */
  const resetPasswordWithCode = async (
    email: string,
    code: string,
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const trimmed = email.trim().toLowerCase();
    const token = code.replace(/\D/g, '');
    if (token.length < 6) return { success: false, error: 'Enter the code from the email.' };
    if (newPassword.length < 8) return { success: false, error: 'Use at least 8 characters.' };
    try {
      const { error: vErr } = await supabase.auth.verifyOtp({ email: trimmed, token, type: 'recovery' });
      if (vErr) return { success: false, error: friendlyAuthError(vErr.message) };
      const { error: uErr } = await supabase.auth.updateUser({ password: newPassword });
      if (uErr) return { success: false, error: friendlyAuthError(uErr.message) };
      logger.info('Auth', 'Password reset with code');
      return { success: true };
    } catch (e) {
      return { success: false, error: friendlyAuthError(e instanceof Error ? e.message : String(e)) };
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
    isBlocked,
    displayName,
    saveFullNameOnce,
    updateAvatar,
    refreshProfile,
    signUp,
    signIn,
    signOut,
    resendVerificationEmail,
    verifyEmailCode,
    resetPassword,
    resetPasswordWithCode,
    clearError,
  };
});
