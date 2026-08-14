'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { getRequestCorrelationId } from '@/lib/observability/request';
import { logOperationalFailure } from '@/lib/observability/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { LoyaltyPolicyState } from './loyalty-state';

export async function updateAdminLoyaltyPolicy(
  _previousState: LoyaltyPolicyState,
  formData: FormData
): Promise<LoyaltyPolicyState> {
  await requireAdmin();
  const earnBps = Number(String(formData.get('earnBps') ?? ''));
  const enabled = formData.get('enabled') === 'on';
  const codEligible = formData.get('codEligible') === 'on';
  const pointsPaymentEnabled = formData.get('pointsPaymentEnabled') === 'on';
  if (!Number.isInteger(earnBps) || earnBps < 0 || earnBps > 10000) {
    return { status: 'error', message: 'Tỷ lệ tích điểm phải nằm trong khoảng 0–10000 bps.' };
  }

  const correlationId = await getRequestCorrelationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('update_loyalty_policy', {
    p_enabled: enabled,
    p_earn_bps: earnBps,
    p_cod_eligible: codEligible,
  });
  if (error || !data?.[0]) {
    logOperationalFailure({ correlationId, event: 'admin_operation_failed', operation: 'update_loyalty_policy', reason: error ? 'database_error' : 'missing_result' });
    return { status: 'error', message: `Không thể cập nhật loyalty policy. Mã hỗ trợ: ${correlationId}` };
  }

  const { error: pointsPolicyError } = await supabase.rpc('update_points_payment_policy', { p_enabled: pointsPaymentEnabled });
  if (pointsPolicyError) {
    logOperationalFailure({ correlationId, event: 'admin_operation_failed', operation: 'update_points_payment_policy', reason: 'database_error' });
    return { status: 'error', message: `Không thể cập nhật policy thanh toán điểm. Mã hỗ trợ: ${correlationId}` };
  }

  revalidatePath('/admin/loyalty');
  revalidatePath('/account');
  return { status: 'success', message: 'Đã cập nhật loyalty policy.' };
}
