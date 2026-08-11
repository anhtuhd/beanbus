'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { logOperationalFailure } from '@/lib/observability/logger';
import { getRequestCorrelationId } from '@/lib/observability/request';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { CommercePolicyState } from './policy-state';

type VoucherPolicy = 'release' | 'consume';

export async function updateAdminCommercePolicy(
  _previousState: CommercePolicyState,
  formData: FormData,
): Promise<CommercePolicyState> {
  await requireAdmin();
  const refundWindowHours = Number(String(formData.get('refundWindowHours') ?? ''));
  const refundEnabled = formData.get('refundEnabled') === 'on';
  const voucherOnCancel = String(formData.get('voucherOnCancel') ?? '') as VoucherPolicy;
  const voucherOnRefund = String(formData.get('voucherOnRefund') ?? '') as VoucherPolicy;
  const loyaltyReverseOnCancel = formData.get('loyaltyReverseOnCancel') === 'on';
  const loyaltyReverseOnRefund = formData.get('loyaltyReverseOnRefund') === 'on';
  if (!Number.isInteger(refundWindowHours) || refundWindowHours < 1 || refundWindowHours > 720) {
    return { status: 'error', message: 'Thời hạn hoàn tiền phải nằm trong khoảng 1–720 giờ.' };
  }
  if (!['release', 'consume'].includes(voucherOnCancel) || !['release', 'consume'].includes(voucherOnRefund)) {
    return { status: 'error', message: 'Lựa chọn vòng đời voucher không hợp lệ.' };
  }

  const correlationId = await getRequestCorrelationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('update_commerce_policy', {
    p_refund_enabled: refundEnabled,
    p_refund_window_hours: refundWindowHours,
    p_voucher_on_cancel: voucherOnCancel,
    p_voucher_on_refund: voucherOnRefund,
    p_loyalty_reverse_on_cancel: loyaltyReverseOnCancel,
    p_loyalty_reverse_on_refund: loyaltyReverseOnRefund,
  });
  if (error || !data?.[0]) {
    logOperationalFailure({ correlationId, event: 'admin_operation_failed', operation: 'update_commerce_policy', reason: error ? 'database_error' : 'missing_result' });
    return { status: 'error', message: `Không thể cập nhật chính sách. Mã hỗ trợ: ${correlationId}` };
  }

  revalidatePath('/admin/policies');
  revalidatePath('/admin/orders');
  revalidatePath('/admin/loyalty');
  return { status: 'success', message: 'Đã cập nhật chính sách thương mại.' };
}
