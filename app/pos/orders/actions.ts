'use server';

import { revalidatePath } from 'next/cache';
import { requireOperator } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function advanceCounterOrder(orderId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireOperator();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc('operator_advance_order', { p_order_id: orderId });
  if (error) {
    if (error.message.includes('PAYMENT_REQUIRED')) return { ok: false, error: 'Đơn QR chưa được xác nhận thanh toán.' };
    if (error.message.includes('ORDER_NOT_FOUND')) return { ok: false, error: 'Không tìm thấy đơn hàng.' };
    if (error.message.includes('INVALID_OPERATOR_TRANSITION')) return { ok: false, error: 'Đơn hàng đã ở trạng thái kết thúc.' };
    return { ok: false, error: 'Không thể chuyển trạng thái đơn hàng.' };
  }
  revalidatePath('/pos');
  revalidatePath(`/pos/orders/${orderId}`);
  revalidatePath('/admin/orders');
  return { ok: true };
}
