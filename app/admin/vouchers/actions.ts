'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { getRequestCorrelationId } from '@/lib/observability/request';
import { logOperationalFailure } from '@/lib/observability/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';
import type { VoucherState } from './voucher-state';

export type VoucherMember = {
  id: string;
  memberNumber: number;
  fullName: string | null;
  phone: string | null;
  email: string | null;
};

export async function searchVoucherMembers(query: string): Promise<VoucherMember[]> {
  await requireAdmin();
  const value = query.trim().slice(0, 80);
  if (value.length < 2) return [];
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('operator_search_members', { p_query: value, p_limit: 20 });
  if (error) return [];
  return (data ?? []).map((row) => ({ id: row.id, memberNumber: row.member_number, fullName: row.full_name, phone: row.phone ?? row.pending_phone, email: row.email }));
}

export async function distributeAdminVoucher(code: string, memberIds: string[]): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  await requireAdmin();
  const value = code.trim().toUpperCase().slice(0, 64);
  const ids = [...new Set(memberIds.filter((id) => UUID.test(id)))].slice(0, 100);
  if (!/^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(value) || ids.length === 0) return { ok: false, error: 'Chọn ít nhất một hội viên và kiểm tra mã voucher.' };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('admin_distribute_voucher', { p_voucher_code: value, p_member_ids: ids });
  if (error) return { ok: false, error: error.message.includes('INVALID_VOUCHER') ? 'Voucher không hợp lệ hoặc không phải voucher chiến dịch.' : 'Không thể phát voucher lúc này.' };
  revalidatePath('/admin/vouchers');
  revalidatePath('/account');
  return { ok: true, count: Number(data ?? 0) };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
