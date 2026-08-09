import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
import { getSupabaseCookieOptions } from './cookie-options.ts';
import type { SupabasePublicConfig } from './public-config.ts';

export function createSupabaseServerClient(
  config: SupabasePublicConfig,
  cookies: CookieMethodsServer
) {
  return createServerClient(config.url, config.publishableKey, {
    cookies,
    cookieOptions: getSupabaseCookieOptions(process.env.NODE_ENV),
  });
}
