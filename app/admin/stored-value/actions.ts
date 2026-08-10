'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { getRequestCorrelationId } from '@/lib/observability/request';
import { logOperationalFailure } from '@/lib/observability/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { StoredValueAdminState } from './stored-value-state';

const UUID = /^[0-9a-f-]{36}$/i;

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function optionalUuid(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value || null;
}

function vietnamDateTime(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}:00+07:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function failure(message: string, correlationId: string): StoredValueAdminState {
  return { status: 'error', message: `${message} Mã hỗ trợ: ${correlationId}` };
}

export async function updateAdminStoredValuePolicy(
  _previousState: StoredValueAdminState,
  formData: FormData
): Promise<StoredValueAdminState> {
  await requireAdmin();
  const correlationId = await getRequestCorrelationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('update_stored_value_policy', {
    p_enabled: formData.get('enabled') === 'on',
    p_topup_enabled: formData.get('topupEnabled') === 'on',
    p_flash_sale_enabled: formData.get('flashSaleEnabled') === 'on',
  });
  if (error || !data?.[0]) {
    logOperationalFailure({ correlationId, event: 'admin_operation_failed', operation: 'update_stored_value_policy', reason: error ? 'database_error' : 'missing_result' });
    return failure('Không thể cập nhật stored-value policy.', correlationId);
  }
  revalidatePath('/admin/stored-value');
  revalidatePath('/account');
  revalidatePath('/account/topup');
  revalidatePath('/flash-sale');
  return { status: 'success', message: 'Đã cập nhật stored-value policy.' };
}

export async function upsertAdminTopupPackage(
  _previousState: StoredValueAdminState,
  formData: FormData
): Promise<StoredValueAdminState> {
  await requireAdmin();
  const packageId = optionalUuid(formData, 'packageId');
  const nameVi = text(formData, 'nameVi');
  const nameEn = text(formData, 'nameEn');
  const amountVnd = Number(text(formData, 'amountVnd'));
  const points = Number(text(formData, 'points'));
  const sortOrder = Number(text(formData, 'sortOrder') || '0');
  if ((packageId && !UUID.test(packageId)) || nameVi.length < 3 || nameVi.length > 180 || nameEn.length < 3 || nameEn.length > 180 || !Number.isInteger(amountVnd) || amountVnd <= 0 || !Number.isInteger(points) || points <= 0 || !Number.isInteger(sortOrder) || sortOrder < 0) {
    return { status: 'error', message: 'Dữ liệu gói nạp không hợp lệ.' };
  }

  const correlationId = await getRequestCorrelationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('admin_upsert_topup_package', {
    p_package_id: packageId,
    p_name_vi: nameVi,
    p_name_en: nameEn,
    p_amount_vnd: amountVnd,
    p_points: points,
    p_is_active: formData.get('isActive') === 'on',
    p_sort_order: sortOrder,
  });
  if (error || !data?.[0]) {
    logOperationalFailure({ correlationId, event: 'admin_operation_failed', operation: 'upsert_stored_value', reason: error ? 'database_error' : 'missing_result' });
    return failure('Không thể lưu gói nạp.', correlationId);
  }
  revalidatePath('/admin/stored-value');
  revalidatePath('/account/topup');
  return { status: 'success', message: data[0].operation === 'created' ? 'Đã tạo gói nạp.' : 'Đã cập nhật gói nạp.' };
}

export async function upsertAdminFlashSaleCampaign(
  _previousState: StoredValueAdminState,
  formData: FormData
): Promise<StoredValueAdminState> {
  await requireAdmin();
  const campaignId = optionalUuid(formData, 'campaignId');
  const slug = text(formData, 'slug');
  const nameVi = text(formData, 'nameVi');
  const nameEn = text(formData, 'nameEn');
  const priceVnd = Number(text(formData, 'priceVnd'));
  const points = Number(text(formData, 'points'));
  const startsAt = vietnamDateTime(text(formData, 'startsAt'));
  const endsAt = vietnamDateTime(text(formData, 'endsAt'));
  const quotaText = text(formData, 'quotaTotal');
  const maxPerUserText = text(formData, 'maxPerUser');
  const quotaTotal = quotaText ? Number(quotaText) : null;
  const maxPerUser = maxPerUserText ? Number(maxPerUserText) : null;
  if ((campaignId && !UUID.test(campaignId)) || !/^[a-z0-9][a-z0-9-]{2,79}$/.test(slug) || nameVi.length < 3 || nameVi.length > 180 || nameEn.length < 3 || nameEn.length > 180 || !Number.isInteger(priceVnd) || priceVnd <= 0 || !Number.isInteger(points) || points <= 0 || !startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt) || (quotaTotal !== null && (!Number.isInteger(quotaTotal) || quotaTotal <= 0)) || (maxPerUser !== null && (!Number.isInteger(maxPerUser) || maxPerUser <= 0))) {
    return { status: 'error', message: 'Dữ liệu flash-sale không hợp lệ.' };
  }

  const correlationId = await getRequestCorrelationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('admin_upsert_flash_sale_campaign', {
    p_campaign_id: campaignId,
    p_slug: slug,
    p_name_vi: nameVi,
    p_name_en: nameEn,
    p_price_vnd: priceVnd,
    p_points: points,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_quota_total: quotaTotal,
    p_max_per_user: maxPerUser,
    p_is_active: formData.get('isActive') === 'on',
  });
  if (error || !data?.[0]) {
    logOperationalFailure({ correlationId, event: 'admin_operation_failed', operation: 'upsert_stored_value', reason: error ? 'database_error' : 'missing_result' });
    return failure('Không thể lưu flash-sale.', correlationId);
  }
  revalidatePath('/admin/stored-value');
  revalidatePath('/flash-sale');
  return { status: 'success', message: data[0].operation === 'created' ? 'Đã tạo flash-sale.' : 'Đã cập nhật flash-sale.' };
}
