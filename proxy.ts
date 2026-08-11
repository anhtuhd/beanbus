import { NextResponse, type NextRequest } from 'next/server';
import { CORRELATION_HEADER, createCorrelationId } from '@/lib/observability/logger';
import { getOptionalSupabasePublicConfig } from '@/lib/supabase/public-config';
import { updateSupabaseSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  const correlationId = createCorrelationId(request.headers.get(CORRELATION_HEADER));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CORRELATION_HEADER, correlationId);
  const config = getOptionalSupabasePublicConfig({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  const response = config
    ? await updateSupabaseSession(request, config, requestHeaders)
    : NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set(CORRELATION_HEADER, correlationId);
  return response;
}

export const config = {
  matcher: [
    '/((?!api/webhooks|hooks/payment|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
