import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getGuestNotificationSessionId } from '@/lib/notifications/guest-session';
import {
  notificationError,
  readBoundedJson,
  validateMutationRequest,
} from '@/lib/notifications/http';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  if (process.env.NEXT_PUBLIC_ENABLE_GUEST_NOTIFICATIONS !== 'true') {
    return notificationError('FEATURE_DISABLED', 'Thông báo khách chưa được bật.', 404);
  }
  const sessionId = await getGuestNotificationSessionId();
  if (!sessionId) return Response.json({ guestSession: false, items: [], unreadCount: 0 });

  const admin = createAdminSupabaseClient();
  const [items, unread] = await Promise.all([
    admin.from('guest_notifications')
      .select('id, title_vi, title_en, body_vi, body_en, href, read_at, created_at')
      .eq('guest_session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(50),
    admin.from('guest_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('guest_session_id', sessionId)
      .is('read_at', null),
  ]);
  if (items.error || unread.error) {
    return notificationError('REQUEST_FAILED', 'Không thể tải thông báo lúc này.', 500);
  }
  await admin.from('guest_notification_sessions').update({ last_seen_at: new Date().toISOString() }).eq('id', sessionId);

  return Response.json(
    { guestSession: true, items: items.data ?? [], unreadCount: unread.count ?? 0 },
    { headers: { 'cache-control': 'no-store' } },
  );
}

export async function PATCH(request: Request) {
  if (process.env.NEXT_PUBLIC_ENABLE_GUEST_NOTIFICATIONS !== 'true') {
    return notificationError('FEATURE_DISABLED', 'Thông báo khách chưa được bật.', 404);
  }
  const invalidRequest = validateMutationRequest(request);
  if (invalidRequest) return invalidRequest;
  const body = await readBoundedJson(request);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return notificationError('INVALID_BODY', 'Dữ liệu gửi lên không hợp lệ.', 422);
  }
  const input = body as Record<string, unknown>;
  const markAll = input.all === true;
  const id = typeof input.id === 'string' && UUID_PATTERN.test(input.id) ? input.id : null;
  if (!markAll && !id) return notificationError('INVALID_BODY', 'Dữ liệu gửi lên không hợp lệ.', 422);

  const sessionId = await getGuestNotificationSessionId();
  if (!sessionId) return notificationError('AUTH_REQUIRED', 'Phiên thông báo đã hết hạn.', 401);
  const admin = createAdminSupabaseClient();
  const { error } = await admin.rpc('mark_guest_notifications_read', {
    p_guest_session_id: sessionId,
    p_notification_id: id,
  });
  if (error) return notificationError('REQUEST_FAILED', 'Không thể cập nhật thông báo.', 500);
  return Response.json({ ok: true });
}
