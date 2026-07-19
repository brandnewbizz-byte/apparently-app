import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://inejlmksbzujgpwvnnch.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImluZWpsbWtzYnp1amdwd3ZubmNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMjkzMjEsImV4cCI6MjA4NDcwNTMyMX0.hcDd2oi_cM1jzQegVMcSVB2UpCFlf52yAn43NRJyELA'
);
