'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { getRequestCorrelationId } from '@/lib/observability/request';
import { logOperationalFailure } from '@/lib/observability/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { ProductEditorState } from './product-editor-state';

const PRODUCT_ID = /^[a-z0-9][a-z0-9-]{0,99}$/;
const BADGES = new Set(['', 'best', 'seasonal', 'new', 'signature']);

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function optionalValue(formData: FormData, key: string): string | null {
  const result = value(formData, key);
  return result || null;
}

export async function upsertAdminProduct(
  _previousState: ProductEditorState,
  formData: FormData
): Promise<ProductEditorState> {
  await requireAdmin();
  const productId = optionalValue(formData, 'productId');
  const categoryId = value(formData, 'categoryId');
  const optionSetId = optionalValue(formData, 'optionSetId');
  const nameVi = value(formData, 'nameVi');
  const nameEn = value(formData, 'nameEn');
  const descriptionVi = value(formData, 'descriptionVi');
  const descriptionEn = value(formData, 'descriptionEn');
  const priceVnd = Number(value(formData, 'priceVnd'));
  const imageUrl = value(formData, 'imageUrl');
  const badge = value(formData, 'badge');
  const tastingNotes = optionalValue(formData, 'tastingNotes');
  const sortOrder = Number(value(formData, 'sortOrder') || '0');
  const isAvailable = formData.get('isAvailable') === 'on';
  const isPublished = formData.get('isPublished') === 'on';

  if ((productId && !PRODUCT_ID.test(productId)) || !categoryId || !nameVi || nameVi.length > 160 || !nameEn || nameEn.length > 160 || descriptionVi.length > 2000 || descriptionEn.length > 2000 || !Number.isInteger(priceVnd) || priceVnd < 0 || !/^https?:\/\//i.test(imageUrl) || !Number.isInteger(sortOrder) || sortOrder < 0 || !BADGES.has(badge)) {
    return { status: 'error', message: 'Dữ liệu sản phẩm không hợp lệ.' };
  }

  const correlationId = await getRequestCorrelationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('admin_upsert_product', {
    p_product_id: productId,
    p_category_id: categoryId,
    p_option_set_id: optionSetId,
    p_name_vi: nameVi,
    p_name_en: nameEn,
    p_description_vi: descriptionVi,
    p_description_en: descriptionEn,
    p_price_vnd: priceVnd,
    p_image_url: imageUrl,
    p_badge: badge || null,
    p_tasting_notes: tastingNotes,
    p_sort_order: sortOrder,
    p_is_available: isAvailable,
    p_is_published: isPublished,
  });

  if (error || !data?.[0]) {
    logOperationalFailure({ correlationId, event: 'admin_operation_failed', operation: 'upsert_catalog_product', reason: error ? 'database_error' : 'missing_result' });
    return { status: 'error', message: `Không thể lưu sản phẩm. Mã hỗ trợ: ${correlationId}` };
  }

  revalidatePath('/admin/catalog');
  revalidatePath('/menu');
  revalidatePath(`/menu/${data[0].updated_product_id}`);
  return { status: 'success', message: data[0].operation === 'created' ? 'Đã tạo sản phẩm.' : 'Đã cập nhật sản phẩm.' };
}
