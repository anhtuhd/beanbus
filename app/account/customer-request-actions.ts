'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentProfile } from '@/lib/auth/session';
import { logOperationalFailure } from '@/lib/observability/logger';
import { getRequestCorrelationId } from '@/lib/observability/request';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { MemberBookingCancelState } from './booking-state';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function cancelMemberCustomerRequest(
  _previousState: MemberBookingCancelState,
  formData: FormData
): Promise<MemberBookingCancelState> {
  const profile = await getCurrentProfile();
  if (!profile) return { status: 'error', message: 'Phiên đăng nhập đã hết hạn.' };

  const requestId = String(formData.get('requestId') ?? '');
  if (!UUID.test(requestId)) return { status: 'error', message: 'Yêu cầu không hợp lệ.' };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('cancel_owned_customer_request', { p_request_id: requestId });
  if (error) {
    if (error.message.includes('REQUEST_CANNOT_CANCEL')) {
      return { status: 'error', message: 'Yêu cầu này không thể hủy ở trạng thái hiện tại.' };
    }
    if (error.message.includes('REQUEST_NOT_FOUND')) {
      return { status: 'error', message: 'Không tìm thấy yêu cầu.' };
    }
    const correlationId = await getRequestCorrelationId();
    logOperationalFailure({ correlationId, event: 'customer_request_failed', operation: 'cancel_customer_request', reason: 'database_error' });
    return { status: 'error', message: `Không thể hủy yêu cầu lúc này. Mã hỗ trợ: ${correlationId}` };
  }
  if (!data?.[0]) {
    const correlationId = await getRequestCorrelationId();
    logOperationalFailure({ correlationId, event: 'customer_request_failed', operation: 'cancel_customer_request', reason: 'missing_result' });
    return { status: 'error', message: `Không thể xác nhận trạng thái yêu cầu. Mã hỗ trợ: ${correlationId}` };
  }

  revalidatePath('/account');
  revalidatePath(`/account/requests/${requestId}`);
  return { status: 'success', message: 'Đã hủy yêu cầu.' };
}
