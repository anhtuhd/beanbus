'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { logOperationalFailure } from '@/lib/observability/logger';
import { getRequestCorrelationId } from '@/lib/observability/request';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type ContentPublicationState = { message: string; status: 'idle' | 'success' | 'error' };
export const initialContentPublicationState: ContentPublicationState = { message: '', status: 'idle' };

const CONTENT_ID = /^(event|post)-[a-z0-9][a-z0-9-]{0,93}$/;

export async function updateContentPublication(
  _previousState: ContentPublicationState,
  formData: FormData
): Promise<ContentPublicationState> {
  await requireAdmin();
  const contentType = String(formData.get('contentType') ?? '');
  const contentId = String(formData.get('contentId') ?? '');
  const isPublished = formData.get('isPublished') === 'on';
  if (!CONTENT_ID.test(contentId) || !['event', 'blog'].includes(contentType)) {
    return { status: 'error', message: 'Nội dung không hợp lệ.' };
  }

  const correlationId = await getRequestCorrelationId();
  const supabase = await createServerSupabaseClient();
  const result = contentType === 'event'
    ? await supabase.rpc('update_event_publication', { p_event_id: contentId, p_is_published: isPublished })
    : await supabase.rpc('update_blog_post_publication', { p_post_id: contentId, p_is_published: isPublished });
  if (result.error || !result.data?.[0]) {
    logOperationalFailure({ correlationId, event: 'admin_operation_failed', operation: 'update_content_publication', reason: result.error ? 'database_error' : 'missing_result' });
    return { status: 'error', message: `Không thể cập nhật trạng thái công bố. Mã hỗ trợ: ${correlationId}` };
  }

  revalidatePath('/admin/content');
  revalidatePath('/events');
  revalidatePath('/blog');
  if (contentType === 'event') revalidatePath(`/events/${contentId}`);
  return { status: 'success', message: isPublished ? 'Đã công bố.' : 'Đã chuyển về bản nháp.' };
}
