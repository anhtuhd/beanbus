'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { logOperationalFailure } from '@/lib/observability/logger';
import { getRequestCorrelationId } from '@/lib/observability/request';
import type { Database } from '@/lib/supabase/database.types';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type OrderStatus = Database['public']['Enums']['order_status'];

export type OrderStatusActionState = {
  message: string;
  status: 'idle' | 'success' | 'error';
};

export const initialOrderStatusState: OrderStatusActionState = { message: '', status: 'idle' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORDER_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];

function actionError(message: string, reference?: string): OrderStatusActionState {
  return { status: 'error', message: reference ? `${message} Mã hỗ trợ: ${reference}` : message };
}

export async function updateAdminOrderStatus(
  _previousState: OrderStatusActionState,
  formData: FormData
): Promise<OrderStatusActionState> {
  await requireAdmin();
  const orderId = String(formData.get('orderId') ?? '');
  const status = String(formData.get('status') ?? '') as OrderStatus;
  if (!UUID.test(orderId) || !ORDER_STATUSES.includes(status)) return actionError('Dữ liệu cập nhật không hợp lệ.');

  const correlationId = await getRequestCorrelationId();
  const supabase = await createServerSupabaseClient();
  let data;
  let error;
  try {
    ({ data, error } = await supabase.rpc('update_order_status', {
      p_order_id: orderId,
      p_status: status,
    }));
  } catch {
    logOperationalFailure({ correlationId, event: 'admin_operation_failed', operation: 'update_order_status', reason: 'database_error' });
    return actionError('Không thể cập nhật trạng thái đơn hàng.', correlationId);
  }
  if (error?.message.includes('PAYMENT_REQUIRED')) {
    logOperationalFailure({ correlationId, event: 'admin_operation_failed', level: 'warn', operation: 'update_order_status', reason: 'payment_required' });
    return actionError('Đơn Sepay đang chờ thanh toán được xác minh.', correlationId);
  }
  if (error?.message.includes('REFUND_REQUIRED')) {
    logOperationalFailure({ correlationId, event: 'admin_operation_failed', level: 'warn', operation: 'update_order_status', reason: 'refund_required' });
    return actionError('Đơn đã thanh toán cần quy trình hoàn tiền trước khi hủy.', correlationId);
  }
  if (error || !data?.[0]) {
    logOperationalFailure({ correlationId, event: 'admin_operation_failed', operation: 'update_order_status', reason: error ? 'database_error' : 'missing_result' });
    return actionError('Không thể cập nhật trạng thái đơn hàng.', correlationId);
  }

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
  return { status: 'success', message: 'Đã cập nhật trạng thái.' };
}
