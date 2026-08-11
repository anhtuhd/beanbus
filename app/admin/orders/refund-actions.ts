'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { logOperationalFailure } from '@/lib/observability/logger';
import { getRequestCorrelationId } from '@/lib/observability/request';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { RefundOrderState } from './refund-state';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function actionError(message: string, reference?: string): RefundOrderState {
  return { status: 'error', message: reference ? `${message} Mã hỗ trợ: ${reference}` : message };
}

export async function refundAdminOrder(
  _previousState: RefundOrderState,
  formData: FormData,
): Promise<RefundOrderState> {
  await requireAdmin();
  const orderId = String(formData.get('orderId') ?? '');
  if (!UUID.test(orderId)) return actionError('Dữ liệu hoàn tiền không hợp lệ.');

  const correlationId = await getRequestCorrelationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('refund_order_payment', { p_order_id: orderId });
  if (error?.message.includes('REFUNDS_DISABLED')) return actionError('Chính sách hiện đang tắt hoàn tiền.');
  if (error?.message.includes('REFUND_WINDOW_EXPIRED')) return actionError('Đơn đã quá thời hạn hoàn tiền theo policy.');
  if (error?.message.includes('REFUND_NOT_ELIGIBLE') || error?.message.includes('PAYMENT_NOT_ELIGIBLE')) return actionError('Đơn chưa đủ điều kiện hoàn tiền.');
  if (error || !data?.[0]) {
    logOperationalFailure({ correlationId, event: 'admin_operation_failed', operation: 'refund_order_payment', reason: error ? 'database_error' : 'missing_result' });
    return actionError('Không thể hoàn tiền đơn hàng.', correlationId);
  }

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
  return { status: 'success', message: 'Đã ghi nhận hoàn tiền và cập nhật voucher/điểm theo policy.' };
}
