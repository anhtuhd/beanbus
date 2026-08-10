'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { getRequestCorrelationId } from '@/lib/observability/request';
import { logOperationalFailure } from '@/lib/observability/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';
import type { RewardAdminState } from './reward-state';

const ID = /^[a-z0-9][a-z0-9-]{2,79}$/;
function text(formData: FormData, key: string): string { return String(formData.get(key) ?? '').trim(); }

export async function upsertAdminReward(_previousState: RewardAdminState, formData: FormData): Promise<RewardAdminState> {
  await requireAdmin();
  const rewardId = text(formData, 'rewardId');
  const nameVi = text(formData, 'nameVi');
  const nameEn = text(formData, 'nameEn');
  const pointsCost = Number(text(formData, 'pointsCost'));
  const discountType = text(formData, 'discountType') as Database['public']['Enums']['discount_type'];
  const discountValue = Number(text(formData, 'discountValue'));
  const minimumSubtotal = Number(text(formData, 'minimumSubtotalVnd') || '0');
  const maximumDiscount = text(formData, 'maximumDiscountVnd') ? Number(text(formData, 'maximumDiscountVnd')) : null;
  const isActive = formData.get('isActive') === 'on';
  if (!ID.test(rewardId) || nameVi.length < 3 || nameVi.length > 180 || nameEn.length < 3 || nameEn.length > 180 || !Number.isInteger(pointsCost) || pointsCost <= 0 || !['percent', 'fixed'].includes(discountType) || !Number.isInteger(discountValue) || discountValue <= 0 || (discountType === 'percent' && discountValue > 100) || !Number.isInteger(minimumSubtotal) || minimumSubtotal < 0 || (maximumDiscount !== null && (!Number.isInteger(maximumDiscount) || maximumDiscount <= 0)) || (discountType === 'fixed' && maximumDiscount !== null)) {
    return { status: 'error', message: 'Dữ liệu reward không hợp lệ.' };
  }
  const correlationId = await getRequestCorrelationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('admin_upsert_loyalty_reward', {
    p_reward_id: rewardId,
    p_name_vi: nameVi,
    p_name_en: nameEn,
    p_points_cost: pointsCost,
    p_discount_type: discountType,
    p_discount_value: discountValue,
    p_minimum_subtotal_vnd: minimumSubtotal,
    p_maximum_discount_vnd: maximumDiscount,
    p_is_active: isActive,
  });
  if (error || !data?.[0]) {
    logOperationalFailure({ correlationId, event: 'admin_operation_failed', operation: 'upsert_loyalty_reward', reason: error ? 'database_error' : 'missing_result' });
    return { status: 'error', message: `Không thể lưu reward. Mã hỗ trợ: ${correlationId}` };
  }
  revalidatePath('/admin/rewards');
  revalidatePath('/account');
  return { status: 'success', message: data[0].operation === 'created' ? 'Đã tạo reward.' : 'Đã cập nhật reward.' };
}
