import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getGuestNotificationSessionId } from '@/lib/notifications/guest-session';
import {
  notificationError,
  readBoundedJson,
  validateMutationRequest,
} from '@/lib/notifications/http';
import { parsePushInstallationInput } from '@/lib/notifications/validation';

async function recipientIds() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null;
  const guestSessionId = process.env.NEXT_PUBLIC_ENABLE_GUEST_NOTIFICATIONS === 'true'
    ? await getGuestNotificationSessionId()
    : null;
  return { guestSessionId, userId };
}

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_ENABLE_WEB_PUSH !== 'true') {
    return notificationError('FEATURE_DISABLED', 'Web Push chưa được bật.', 404);
  }
  const invalidRequest = validateMutationRequest(request);
  if (invalidRequest) return invalidRequest;
  const parsed = parsePushInstallationInput(await readBoundedJson(request));
  if (!parsed.ok) return notificationError('INVALID_BODY', 'Thiết bị thông báo không hợp lệ.', 422);

  const { guestSessionId, userId } = await recipientIds();
  if (!userId && !guestSessionId) return notificationError('AUTH_REQUIRED', 'Không có phiên nhận thông báo hợp lệ.', 401);
  const admin = createAdminSupabaseClient();
  const { error } = await admin.rpc('register_fcm_installation', {
    p_fid: parsed.data.fid,
    p_guest_session_id: guestSessionId,
    p_locale: parsed.data.locale,
    p_user_id: userId,
  });
  if (error) return notificationError('REQUEST_FAILED', 'Không thể bật Web Push lúc này.', 500);
  return Response.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  if (process.env.NEXT_PUBLIC_ENABLE_WEB_PUSH !== 'true') {
    return notificationError('FEATURE_DISABLED', 'Web Push chưa được bật.', 404);
  }
  const invalidRequest = validateMutationRequest(request);
  if (invalidRequest) return invalidRequest;
  const body = await readBoundedJson(request);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return notificationError('INVALID_BODY', 'Dữ liệu gửi lên không hợp lệ.', 422);
  }

  const input = body as Record<string, unknown>;
  const { guestSessionId, userId } = await recipientIds();
  const admin = createAdminSupabaseClient();
  if (input.scope === 'current-user') {
    if (!userId) return notificationError('AUTH_REQUIRED', 'Bạn chưa đăng nhập.', 401);
    const parsed = parsePushInstallationInput({ fid: input.fid, locale: 'vi' });
    if (!parsed.ok) return notificationError('INVALID_BODY', 'Thiết bị thông báo không hợp lệ.', 422);
    const { error } = await admin.rpc('unlink_fcm_installation', {
      p_disable: false,
      p_fid: parsed.data.fid,
      p_guest_session_id: null,
      p_user_id: userId,
    });
    if (error) return notificationError('REQUEST_FAILED', 'Không thể cập nhật Web Push.', 500);
    return Response.json({ ok: true });
  }

  const parsed = parsePushInstallationInput({ fid: input.fid, locale: 'vi' });
  if (!parsed.ok) return notificationError('INVALID_BODY', 'Thiết bị thông báo không hợp lệ.', 422);
  if (!userId && !guestSessionId) {
    return notificationError('AUTH_REQUIRED', 'Không có phiên nhận thông báo hợp lệ.', 401);
  }
  const { data, error } = await admin.rpc('unlink_fcm_installation', {
    p_disable: true,
    p_fid: parsed.data.fid,
    p_guest_session_id: guestSessionId,
    p_user_id: userId,
  });
  if (error || data !== true) return notificationError('REQUEST_FAILED', 'Không thể tắt Web Push lúc này.', 500);
  return Response.json({ ok: true });
}
