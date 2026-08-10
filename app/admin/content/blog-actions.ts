'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { getRequestCorrelationId } from '@/lib/observability/request';
import { logOperationalFailure } from '@/lib/observability/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { ContentEditorState } from './content-editor-state';

const POST_ID = /^post-[a-z0-9][a-z0-9-]{0,92}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/;

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function optionalText(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value || null;
}

export async function upsertAdminBlogPost(
  _previousState: ContentEditorState,
  formData: FormData
): Promise<ContentEditorState> {
  await requireAdmin();
  const postId = optionalText(formData, 'postId');
  const slug = text(formData, 'slug');
  const titleVi = text(formData, 'titleVi');
  const titleEn = text(formData, 'titleEn');
  const categoryVi = text(formData, 'categoryVi');
  const categoryEn = text(formData, 'categoryEn');
  const author = text(formData, 'author');
  const readTimeVi = text(formData, 'readTimeVi');
  const readTimeEn = text(formData, 'readTimeEn');
  const excerptVi = text(formData, 'excerptVi');
  const excerptEn = text(formData, 'excerptEn');
  const contentVi = text(formData, 'contentVi');
  const contentEn = text(formData, 'contentEn');
  const coverImageUrl = text(formData, 'coverImageUrl');
  const sortOrder = Number(text(formData, 'sortOrder') || '0');

  if ((postId && !POST_ID.test(postId)) || !SLUG.test(slug) || titleVi.length < 3 || titleVi.length > 180 || titleEn.length < 3 || titleEn.length > 180 || categoryVi.length < 2 || categoryVi.length > 80 || categoryEn.length < 2 || categoryEn.length > 80 || author.length < 2 || author.length > 100 || readTimeVi.length < 2 || readTimeVi.length > 40 || readTimeEn.length < 2 || readTimeEn.length > 40 || excerptVi.length < 10 || excerptVi.length > 500 || excerptEn.length < 10 || excerptEn.length > 500 || contentVi.length < 50 || contentVi.length > 50000 || contentEn.length < 50 || contentEn.length > 50000 || !/^https:\/\//i.test(coverImageUrl) || !Number.isInteger(sortOrder) || sortOrder < 0) {
    return { status: 'error', message: 'Dữ liệu bài viết không hợp lệ.' };
  }

  const correlationId = await getRequestCorrelationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('admin_upsert_blog_post', {
    p_post_id: postId,
    p_slug: slug,
    p_title_vi: titleVi,
    p_title_en: titleEn,
    p_category_vi: categoryVi,
    p_category_en: categoryEn,
    p_author: author,
    p_read_time_vi: readTimeVi,
    p_read_time_en: readTimeEn,
    p_excerpt_vi: excerptVi,
    p_excerpt_en: excerptEn,
    p_content_vi: contentVi,
    p_content_en: contentEn,
    p_cover_image_url: coverImageUrl,
    p_is_published: formData.get('isPublished') === 'on',
    p_sort_order: sortOrder,
  });
  if (error || !data?.[0]) {
    logOperationalFailure({ correlationId, event: 'admin_operation_failed', operation: 'upsert_content', reason: error ? 'database_error' : 'missing_result' });
    return { status: 'error', message: `Không thể lưu bài viết. Mã hỗ trợ: ${correlationId}` };
  }

  revalidatePath('/admin/content');
  revalidatePath('/blog');
  revalidatePath(`/blog/${slug}`);
  return { status: 'success', message: data[0].operation === 'created' ? 'Đã tạo bài viết.' : 'Đã cập nhật bài viết.' };
}
