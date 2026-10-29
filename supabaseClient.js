import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://inejlmksbzujgpwvnnch.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImluZWpsbWtzYnp1amdwd3ZubmNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMjkzMjEsImV4cCI6MjA4NDcwNTMyMX0.hcDd2oi_cM1jzQegVMcSVB2UpCFlf52yAn43NRJyELA';

// Persist the auth session on device so the access token survives app restarts
// and auto-refreshes. Without AsyncStorage, React Native keeps the session in
// memory only, and after a restart/expiry the client silently falls back to the
// `anon` role — which produces "permission denied for table profiles" (42501)
// on any authenticated write (e.g. updating your profile picture).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // The web version lives on the same site as the admin dashboard (/app), so it
    // keeps its own sign-in. Otherwise signing in to one signs the other in/out.
    ...(Platform.OS === 'web' ? { storageKey: 'apparently-app-web-auth' } : {}),
  },
});
