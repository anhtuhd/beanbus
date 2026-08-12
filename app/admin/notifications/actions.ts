'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type AnnouncementState = { status: 'idle' | 'success' | 'error'; message: string };
export const initialAnnouncementState: AnnouncementState = { status: 'idle', message: '' };

export async function publishAnnouncement(
  _previousState: AnnouncementState,
  formData: FormData,
): Promise<AnnouncementState> {
  await requireAdmin();
  if (process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS !== 'true') {
    return { status: 'error', message: 'Trung tâm thông báo đang tắt.' };
  }
  const titleVi = String(formData.get('titleVi') ?? '').trim();
  const titleEn = String(formData.get('titleEn') ?? '').trim();
  const bodyVi = String(formData.get('bodyVi') ?? '').trim();
  const bodyEn = String(formData.get('bodyEn') ?? '').trim();
  const href = String(formData.get('href') ?? '').trim() || null;
  const sendEmail = formData.get('sendEmail') === 'on';
  if (titleVi.length < 3 || titleVi.length > 180 || titleEn.length < 3 || titleEn.length > 180 || bodyVi.length < 10 || bodyVi.length > 1000 || bodyEn.length < 10 || bodyEn.length > 1000 || (href && (!href.startsWith('/') || href.startsWith('//')))) {
    return { status: 'error', message: 'Nội dung thông báo không hợp lệ.' };
  }
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc('publish_store_announcement', {
    p_title_vi: titleVi,
    p_title_en: titleEn,
    p_body_vi: bodyVi,
    p_body_en: bodyEn,
    p_href: href,
    p_send_email: sendEmail,
  });
  if (error) return { status: 'error', message: 'Không thể phát hành thông báo cửa hàng.' };
  revalidatePath('/admin/notifications');
  return { status: 'success', message: 'Đã gửi thông báo tới hội viên.' };
}
