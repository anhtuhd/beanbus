import type { CookieOptions } from '@supabase/ssr';

export function getSupabaseCookieOptions(
  nodeEnv: string | undefined = process.env.NODE_ENV
): CookieOptions {
  return {
    path: '/',
    sameSite: 'lax',
    secure: nodeEnv === 'production',
    // Supabase's browser client must read its refresh token to maintain the session.
    httpOnly: false,
  };
}
