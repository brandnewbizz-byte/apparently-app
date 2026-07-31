import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://inejlmksbzujgpwvnnch.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImluZWpsbWtzYnp1amdwd3ZubmNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMjkzMjEsImV4cCI6MjA4NDcwNTMyMX0.hcDd2oi_cM1jzQegVMcSVB2UpCFlf52yAn43NRJyELA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
