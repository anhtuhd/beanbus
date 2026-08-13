import { NextResponse, type NextRequest } from 'next/server';
import type { SupabasePublicConfig } from './public-config.ts';
import { createSupabaseServerClient } from './server-client.ts';

export async function updateSupabaseSession(
  request: NextRequest,
  config: SupabasePublicConfig,
  requestHeaders: Headers = request.headers
) {
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const projectRef = new URL(config.url).hostname.split('.')[0];
  const authCookieName = `sb-${projectRef}-auth-token`;
  const hasAuthCookie = request.cookies
    .getAll()
    .some(({ name }) => name === authCookieName || name.startsWith(`${authCookieName}.`));

  if (!hasAuthCookie) return response;

  const supabase = createSupabaseServerClient(config, {
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet, headers) {
      cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request: { headers: requestHeaders } });
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });
      Object.entries(headers).forEach(([name, value]) => {
        response.headers.set(name, value);
      });
    },
  });

  await supabase.auth.getClaims();

  return response;
}
