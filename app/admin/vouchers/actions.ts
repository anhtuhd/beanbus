'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { getRequestCorrelationId } from '@/lib/observability/request';
import { logOperationalFailure } from '@/lib/observability/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';
import type { VoucherState } from './voucher-state';

function text(formData: FormData, key: string): string { return String(formData.get(key) ?? '').trim(); }
function parseDate(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function upsertAdminVoucher(_previousState: VoucherState, formData: FormData): Promise<VoucherState> {
  await requireAdmin();
  const code = text(formData, 'code').toUpperCase();
  const discountType = text(formData, 'discountType') as Database['public']['Enums']['discount_type'];
  const discountValue = Number(text(formData, 'discountValue'));
  const minimumSubtotal = Number(text(formData, 'minimumSubtotalVnd') || '0');
  const maximumDiscount = text(formData, 'maximumDiscountVnd') ? Number(text(formData, 'maximumDiscountVnd')) : null;
  const startsAt = parseDate(text(formData, 'startsAt'));
  const endsAt = parseDate(text(formData, 'endsAt'));
  const usageLimit = text(formData, 'usageLimit') ? Number(text(formData, 'usageLimit')) : null;
  const isActive = formData.get('isActive') === 'on';
  if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(code) || !['percent', 'fixed'].includes(discountType) || !Number.isInteger(discountValue) || discountValue <= 0 || (discountType === 'percent' && discountValue > 100) || !Number.isInteger(minimumSubtotal) || minimumSubtotal < 0 || (maximumDiscount !== null && (!Number.isInteger(maximumDiscount) || maximumDiscount <= 0)) || (discountType === 'fixed' && maximumDiscount !== null) || (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit <= 0)) || (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt))) {
    return { status: 'error', message: 'Dữ liệu voucher không hợp lệ.' };
  }

  const correlationId = await getRequestCorrelationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('admin_upsert_voucher', {
    p_code: code,
    p_discount_type: discountType,
    p_discount_value: discountValue,
    p_minimum_subtotal_vnd: minimumSubtotal,
    p_maximum_discount_vnd: maximumDiscount,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_usage_limit: usageLimit,
    p_is_active: isActive,
  });
  if (error || !data?.[0]) {
    logOperationalFailure({ correlationId, event: 'admin_operation_failed', operation: 'upsert_voucher', reason: error ? 'database_error' : 'missing_result' });
    return { status: 'error', message: `Không thể lưu voucher. Mã hỗ trợ: ${correlationId}` };
  }
  revalidatePath('/admin/vouchers');
  revalidatePath('/account');
  return { status: 'success', message: data[0].operation === 'created' ? 'Đã tạo voucher.' : 'Đã cập nhật voucher.' };
}
