import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';
import { getSupabasePublicConfig } from './public-config.ts';

export function createPublicSupabaseClient() {
  const { url, publishableKey } = getSupabasePublicConfig();
  return createClient<Database>(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
