'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { logOperationalFailure } from '@/lib/observability/logger';
import { getRequestCorrelationId } from '@/lib/observability/request';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type RequestStatusActionState = {
  message: string;
  status: 'idle' | 'success' | 'error';
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BOOKING_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'rejected'];
const CUSTOMER_STATUSES = ['pending', 'in_progress', 'resolved', 'rejected'];

function invalidState(): RequestStatusActionState {
  return { status: 'error', message: 'Dữ liệu cập nhật không hợp lệ.' };
}

export async function updateBookingRequestStatus(
  _previousState: RequestStatusActionState,
  formData: FormData
): Promise<RequestStatusActionState> {
  await requireAdmin();
  const requestId = String(formData.get('requestId') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!UUID.test(requestId) || !BOOKING_STATUSES.includes(status)) return invalidState();

  const correlationId = await getRequestCorrelationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('update_booking_request_status', {
    p_request_id: requestId,
    p_status: status,
  });
  if (error || !data?.[0]) {
    logOperationalFailure({ correlationId, event: 'admin_operation_failed', operation: 'update_booking_status', reason: error ? 'database_error' : 'missing_result' });
    return { status: 'error', message: `Không thể cập nhật trạng thái đặt bàn. Mã hỗ trợ: ${correlationId}` };
  }

  revalidatePath('/admin/requests');
  revalidatePath(`/admin/requests/${requestId}`);
  return { status: 'success', message: 'Đã cập nhật trạng thái.' };
}

export async function updateCustomerRequestStatus(
  _previousState: RequestStatusActionState,
  formData: FormData
): Promise<RequestStatusActionState> {
  await requireAdmin();
  const requestId = String(formData.get('requestId') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!UUID.test(requestId) || !CUSTOMER_STATUSES.includes(status)) return invalidState();

  const correlationId = await getRequestCorrelationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('update_customer_request_status', {
    p_request_id: requestId,
    p_status: status,
  });
  if (error || !data?.[0]) {
    logOperationalFailure({ correlationId, event: 'admin_operation_failed', operation: 'update_customer_request_status', reason: error ? 'database_error' : 'missing_result' });
    return { status: 'error', message: `Không thể cập nhật trạng thái yêu cầu. Mã hỗ trợ: ${correlationId}` };
  }

  revalidatePath('/admin/requests');
  revalidatePath(`/admin/requests/${requestId}`);
  return { status: 'success', message: 'Đã cập nhật trạng thái.' };
}
