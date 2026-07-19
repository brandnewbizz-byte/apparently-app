import { Alert, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

type RequireUserResult = {
  userId: string;
};

export async function requireSupabaseUser(opts?: { onMissingUserMessage?: string }): Promise<RequireUserResult | null> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.log('[SupabaseSave] auth.getUser error:', error);
    }

    const userId = data?.user?.id ?? null;
    if (!userId) {
      const msg = opts?.onMissingUserMessage ?? 'Please log in first';
      console.log('[SupabaseSave] Missing user session');
      if (Platform.OS === 'web') {
        Alert.alert('Login required', msg);
      } else {
        Alert.alert('Login required', msg);
      }
      return null;
    }

    return { userId };
  } catch (e) {
    console.error('[SupabaseSave] requireSupabaseUser unexpected error:', e);
    Alert.alert('Error', 'Unable to verify your login. Please try again.');
    return null;
  }
}

export function showSavedToBackendToast() {
  console.log('[SupabaseSave] Saved to backend!');
  Alert.alert('Saved', 'Saved to backend!');
}
