import 'server-only';

import { cookies } from 'next/headers';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createGuestSessionToken, verifyGuestSessionToken } from './guest-session-token';

export const GUEST_NOTIFICATION_COOKIE = 'beanbus_guest_notifications';
export const GUEST_NOTIFICATION_MAX_AGE = 7 * 24 * 60 * 60;

function guestNotificationSecret(): string {
  const secret = process.env.GUEST_NOTIFICATION_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error('Guest notifications are not configured.');
  return secret;
}

export async function getGuestNotificationSessionId(): Promise<string | null> {
  const token = (await cookies()).get(GUEST_NOTIFICATION_COOKIE)?.value;
  if (!token) return null;
  const sessionId = await verifyGuestSessionToken(token, guestNotificationSecret());
  if (!sessionId) return null;
  const { data, error } = await createAdminSupabaseClient()
    .from('guest_notification_sessions')
    .select('id')
    .eq('id', sessionId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  return error || !data ? null : sessionId;
}

export async function linkGuestOrderNotifications(orderId: string): Promise<boolean> {
  if (process.env.NEXT_PUBLIC_ENABLE_GUEST_NOTIFICATIONS !== 'true') return false;

  const cookieStore = await cookies();
  const existingSessionId = await getGuestNotificationSessionId();
  const sessionId = existingSessionId ?? crypto.randomUUID();
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc('link_guest_order_notifications', {
    p_guest_session_id: sessionId,
    p_order_id: orderId,
  });
  if (error || data !== true) return false;

  cookieStore.set(GUEST_NOTIFICATION_COOKIE, await createGuestSessionToken(sessionId, guestNotificationSecret()), {
    httpOnly: true,
    maxAge: GUEST_NOTIFICATION_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return true;
}
