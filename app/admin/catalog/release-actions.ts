'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { invalidateCatalogCache } from '@/lib/cache/tags';
import { getRequestCorrelationId } from '@/lib/observability/request';
import { logOperationalFailure } from '@/lib/observability/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { asCatalogJson, parseCatalogSnapshot, type CatalogSnapshot } from '@/lib/catalog/release';
import { promoteMediaObject } from '@/lib/media/r2';

export type CatalogReleaseActionState = {
  status: 'idle' | 'success' | 'error';
  message: string;
  lockVersion?: number;
  publishedVersion?: number;
};

export const initialCatalogReleaseActionState: CatalogReleaseActionState = { status: 'idle', message: '' };

function failure(message: string): CatalogReleaseActionState {
  return { status: 'error', message };
}

function snapshotFromForm(formData: FormData): { snapshot: CatalogSnapshot; lockVersion: number } | null {
  const rawSnapshot = String(formData.get('snapshot') ?? '');
  const lockVersion = Number(String(formData.get('lockVersion') ?? ''));
  if (!rawSnapshot || rawSnapshot.length > 2 * 1024 * 1024 || !Number.isSafeInteger(lockVersion) || lockVersion < 1) return null;
  try {
    const snapshot = parseCatalogSnapshot(JSON.parse(rawSnapshot));
    return snapshot ? { snapshot, lockVersion } : null;
  } catch {
    return null;
  }
}

type DraftMediaIntent = { targetProductId: string; publicUrl: string; stagingKey: string; finalKey: string; contentLength: number };

function mediaFromForm(formData: FormData): DraftMediaIntent[] | null {
  const raw = String(formData.get('mediaUploads') ?? '[]');
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || value.length > 12) return null;
    const result: DraftMediaIntent[] = [];
    for (const item of value) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      if (![record.targetProductId, record.publicUrl, record.stagingKey, record.finalKey].every((field) => typeof field === 'string' && field.trim())) return null;
      if (typeof record.contentLength !== 'number' || !Number.isInteger(record.contentLength) || record.contentLength <= 0) return null;
      result.push({ targetProductId: record.targetProductId as string, publicUrl: record.publicUrl as string, stagingKey: record.stagingKey as string, finalKey: record.finalKey as string, contentLength: record.contentLength });
    }
    return result;
  } catch {
    return null;
  }
}

function revalidateCatalog() {
  revalidatePath('/admin/catalog');
  revalidatePath('/admin/catalog/preview');
  revalidatePath('/menu');
  revalidatePath('/order');
  invalidateCatalogCache();
}

export async function saveCatalogDraft(_previous: CatalogReleaseActionState, formData: FormData): Promise<CatalogReleaseActionState> {
  const admin = await requireAdmin();
  const input = snapshotFromForm(formData);
  if (!input) return failure('Bản nháp không hợp lệ hoặc đã quá lớn.');
  const mediaUploads = mediaFromForm(formData);
  if (!mediaUploads) return failure('Danh sách ảnh tải lên không hợp lệ.');
  const correlationId = await getRequestCorrelationId();
  try {
    for (const media of mediaUploads) {
      const publicUrl = await promoteMediaObject({ adminId: admin.id, stagingKey: media.stagingKey, finalKey: media.finalKey, contentLength: media.contentLength });
      const product = input.snapshot.products.find((item) => item.id === media.targetProductId);
      if (!product || product.imageUrl !== media.publicUrl || publicUrl !== media.publicUrl) throw new Error('INVALID_MEDIA_TARGET');
      product.imageUrl = publicUrl;
    }
  } catch {
    logOperationalFailure({ correlationId, event: 'admin_operation_failed', operation: 'upsert_catalog_product', reason: 'unsupported_media_type' });
    return failure(`Ảnh bản nháp chưa thể hoàn tất. Mã hỗ trợ: ${correlationId}`);
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('save_catalog_draft', { p_snapshot: asCatalogJson(input.snapshot), p_expected_lock_version: input.lockVersion });
  if (error || !data?.[0]) {
    const reason = error?.message.includes('CATALOG_VERSION_CONFLICT') ? 'invalid_payload' : 'database_error';
    logOperationalFailure({ correlationId, event: 'admin_operation_failed', operation: 'upsert_catalog_product', reason });
    return failure(error?.message.includes('CATALOG_VERSION_CONFLICT') ? 'Bản nháp đã được quản trị viên khác thay đổi. Hãy tải lại trước khi lưu.' : `Không thể lưu bản nháp. Mã hỗ trợ: ${correlationId}`);
  }
  revalidateCatalog();
  return { status: 'success', message: 'Đã lưu bản nháp menu.', lockVersion: data[0].lock_version };
}

export async function publishCatalogDraft(_previous: CatalogReleaseActionState, formData: FormData): Promise<CatalogReleaseActionState> {
  await requireAdmin();
  const lockVersion = Number(String(formData.get('lockVersion') ?? ''));
  if (!Number.isSafeInteger(lockVersion) || lockVersion < 1) return failure('Phiên bản bản nháp không hợp lệ.');
  const correlationId = await getRequestCorrelationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('publish_catalog_draft', { p_expected_lock_version: lockVersion });
  if (error || !data?.[0]) {
    logOperationalFailure({ correlationId, event: 'admin_operation_failed', operation: 'upsert_catalog_product', reason: error?.message.includes('CATALOG_VERSION_CONFLICT') ? 'invalid_payload' : 'database_error' });
    return failure(error?.message.includes('CATALOG_VERSION_CONFLICT') ? 'Bản nháp đã được thay đổi. Hãy tải lại trước khi xuất bản.' : `Không thể xuất bản menu. Mã hỗ trợ: ${correlationId}`);
  }
  revalidateCatalog();
  return { status: 'success', message: `Đã xuất bản menu phiên bản ${data[0].published_version}.`, lockVersion: data[0].draft_lock_version, publishedVersion: data[0].published_version };
}
