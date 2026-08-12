import { NextResponse } from 'next/server';
import { safeRedirectPath } from '@/lib/auth/input';
import { resolveAuthOrigin } from '@/lib/auth/origin';
import {
  createRecoveryCapability,
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_MAX_AGE,
} from '@/lib/auth/password-recovery';
import { resolvePostAuthPath } from '@/lib/auth/redirect';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = safeRedirectPath(requestUrl.searchParams.get('next'));
  const siteUrl = resolveAuthOrigin({
    configuredUrl: process.env.NEXT_PUBLIC_SITE_URL,
    fallbackOrigin: requestUrl.origin,
  });

  if (!siteUrl) {
    return NextResponse.json({ error: 'Authentication callback is not configured.' }, { status: 500 });
  }

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { data: exchangeData, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const redirectType = (exchangeData as { redirectType?: string }).redirectType;
      const isPasswordRecovery = redirectType === 'recovery';
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
      const userId = claimsData?.claims?.sub;
      const { data: profile, error: profileError } = userId
        ? await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
        : { data: null, error: claimsError };

      if (!claimsError && !profileError && profile) {
        if (isPasswordRecovery) {
          if (profile.role === 'admin') {
            const response = NextResponse.redirect(new URL('/admin/security?recovery=1', siteUrl));
            response.cookies.set(PASSWORD_RECOVERY_COOKIE, await createRecoveryCapability(exchangeData.user.id), {
              httpOnly: true,
              maxAge: PASSWORD_RECOVERY_MAX_AGE,
              path: '/admin/security',
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
            });
            return response;
          }
          await supabase.auth.signOut({ scope: 'local' });
          return NextResponse.redirect(new URL('/login?error=recovery_unavailable', siteUrl));
        }
        return NextResponse.redirect(new URL(resolvePostAuthPath(profile.role, next), siteUrl));
      }

      await supabase.auth.signOut();
      return NextResponse.redirect(new URL('/login?error=profile_unavailable', siteUrl));
    }
  }

  return NextResponse.redirect(new URL('/login?error=oauth_callback_failed', siteUrl));
}
