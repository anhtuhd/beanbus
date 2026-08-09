'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseCookieOptions } from './cookie-options.ts';
import {
  getSupabasePublicConfig,
  type SupabasePublicConfig,
} from './public-config.ts';

function getBrowserConfig(): SupabasePublicConfig {
  return getSupabasePublicConfig({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

export function createBrowserSupabaseClient(
  config: SupabasePublicConfig = getBrowserConfig()
) {
  return createBrowserClient(config.url, config.publishableKey, {
    cookieOptions: getSupabaseCookieOptions(process.env.NODE_ENV),
  });
}
