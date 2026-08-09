import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdminConfig } from './admin-config.ts';

export function createAdminSupabaseClient() {
  const { url, secretKey } = getSupabaseAdminConfig({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
