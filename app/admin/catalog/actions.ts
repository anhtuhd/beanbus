'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { logOperationalFailure } from '@/lib/observability/logger';
import { getRequestCorrelationId } from '@/lib/observability/request';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type ProductStatusActionState = {
  message: string;
  status: 'idle' | 'success' | 'error';
};

export const initialProductStatusState: ProductStatusActionState = { message: '', status: 'idle' };

const PRODUCT_ID = /^[a-z0-9][a-z0-9-]{0,99}$/;

export async function updateAdminProductStatus(
  _previousState: ProductStatusActionState,
  formData: FormData
): Promise<ProductStatusActionState> {
  await requireAdmin();
  const productId = String(formData.get('productId') ?? '');
  if (!PRODUCT_ID.test(productId)) return { status: 'error', message: 'Mã sản phẩm không hợp lệ.' };

  const correlationId = await getRequestCorrelationId();
  const supabase = await createServerSupabaseClient();
  const intent = String(formData.get('intent') ?? 'status');
  if (intent === 'archive') {
    const { data, error } = await supabase.rpc('admin_archive_product', { p_product_id: productId });
    if (error || !data?.[0]) {
      logOperationalFailure({ correlationId, event: 'admin_operation_failed', operation: 'archive_catalog_product', reason: error ? 'database_error' : 'missing_result' });
      return { status: 'error', message: `Không thể lưu trữ sản phẩm. Mã hỗ trợ: ${correlationId}` };
    }
    revalidatePath('/admin/catalog');
    revalidatePath('/menu');
    revalidatePath(`/menu/${productId}`);
    return { status: 'success', message: 'Đã lưu trữ sản phẩm; dữ liệu đơn cũ vẫn được giữ nguyên.' };
  }

  const { data, error } = await supabase.rpc('update_product_status', {
    p_product_id: productId,
    p_is_available: formData.get('isAvailable') === 'on',
    p_is_published: formData.get('isPublished') === 'on',
  });
  if (error || !data?.[0]) {
    logOperationalFailure({ correlationId, event: 'admin_operation_failed', operation: 'update_catalog_status', reason: error ? 'database_error' : 'missing_result' });
    return { status: 'error', message: `Không thể cập nhật trạng thái sản phẩm. Mã hỗ trợ: ${correlationId}` };
  }

  revalidatePath('/admin/catalog');
  revalidatePath('/menu');
  return { status: 'success', message: 'Đã cập nhật sản phẩm.' };
}
