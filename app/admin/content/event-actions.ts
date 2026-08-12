'use server';

import { revalidatePath } from 'next/cache';
import { invalidateEventsCache } from '@/lib/cache/tags';
import { requireAdmin } from '@/lib/auth/session';
import { getRequestCorrelationId } from '@/lib/observability/request';
import { logOperationalFailure } from '@/lib/observability/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { ContentEditorState } from './content-editor-state';

const EVENT_ID = /^event-[a-z0-9][a-z0-9-]{0,92}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/;

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function optionalText(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value || null;
}

function parseVietnamDateTime(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function upsertAdminEvent(
  _previousState: ContentEditorState,
  formData: FormData
): Promise<ContentEditorState> {
  await requireAdmin();
  const eventId = optionalText(formData, 'eventId');
  const slug = text(formData, 'slug');
  const titleVi = text(formData, 'titleVi');
  const titleEn = text(formData, 'titleEn');
  const summaryVi = text(formData, 'summaryVi');
  const summaryEn = text(formData, 'summaryEn');
  const descriptionVi = text(formData, 'descriptionVi');
  const descriptionEn = text(formData, 'descriptionEn');
  const startsAt = parseVietnamDateTime(text(formData, 'startsAt'));
  const endsAt = parseVietnamDateTime(text(formData, 'endsAt'));
  const timeLabel = text(formData, 'timeLabel');
  const location = text(formData, 'location');
  const imageUrl = text(formData, 'imageUrl');
  const maxSeatsText = text(formData, 'maxSeats');
  const maxSeats = maxSeatsText ? Number(maxSeatsText) : null;
  const sortOrder = Number(text(formData, 'sortOrder') || '0');

  if ((eventId && !EVENT_ID.test(eventId)) || !SLUG.test(slug) || titleVi.length < 3 || titleVi.length > 180 || titleEn.length < 3 || titleEn.length > 180 || summaryVi.length < 10 || summaryVi.length > 500 || summaryEn.length < 10 || summaryEn.length > 500 || descriptionVi.length < 20 || descriptionVi.length > 10000 || descriptionEn.length < 20 || descriptionEn.length > 10000 || !startsAt || (endsAt && new Date(endsAt) <= new Date(startsAt)) || timeLabel.length < 3 || timeLabel.length > 50 || location.length < 3 || location.length > 300 || !/^https:\/\//i.test(imageUrl) || (maxSeats !== null && (!Number.isInteger(maxSeats) || maxSeats <= 0)) || !Number.isInteger(sortOrder) || sortOrder < 0) {
    return { status: 'error', message: 'Dữ liệu sự kiện không hợp lệ.' };
  }

  const correlationId = await getRequestCorrelationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('admin_upsert_event', {
    p_event_id: eventId,
    p_slug: slug,
    p_title_vi: titleVi,
    p_title_en: titleEn,
    p_summary_vi: summaryVi,
    p_summary_en: summaryEn,
    p_description_vi: descriptionVi,
    p_description_en: descriptionEn,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_time_label: timeLabel,
    p_location: location,
    p_image_url: imageUrl,
    p_max_seats: maxSeats,
    p_is_featured: formData.get('isFeatured') === 'on',
    p_is_published: formData.get('isPublished') === 'on',
    p_sort_order: sortOrder,
  });
  if (error || !data?.[0]) {
    logOperationalFailure({ correlationId, event: 'admin_operation_failed', operation: 'upsert_content', reason: error ? 'database_error' : 'missing_result' });
    return { status: 'error', message: `Không thể lưu sự kiện. Mã hỗ trợ: ${correlationId}` };
  }

  const id = data[0].updated_event_id;
  revalidatePath('/admin/content');
  revalidatePath('/events');
  revalidatePath(`/events/${id}`);
  invalidateEventsCache();
  return { status: 'success', message: data[0].operation === 'created' ? 'Đã tạo sự kiện.' : 'Đã cập nhật sự kiện.' };
}
