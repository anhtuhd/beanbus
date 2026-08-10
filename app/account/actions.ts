'use server';

import { revalidatePath } from 'next/cache';
import { normalizeVietnameseMobile } from '@/lib/auth/input';
import { getCurrentProfile } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { ProfileUpdateState } from './profile-state';

export async function updateMemberProfile(
  _previousState: ProfileUpdateState,
  formData: FormData
): Promise<ProfileUpdateState> {
  const profile = await getCurrentProfile();
  if (!profile) return { status: 'error', message: 'Phiên đăng nhập đã hết hạn.' };

  const fullName = String(formData.get('fullName') ?? '').trim();
  const rawPhone = String(formData.get('phone') ?? '').trim();
  const birthday = String(formData.get('birthday') ?? '').trim();
  const phone = rawPhone ? normalizeVietnameseMobile(rawPhone) : null;

  if (fullName.length < 2 || fullName.length > 100) {
    return { status: 'error', message: 'Họ tên cần có từ 2 đến 100 ký tự.' };
  }
  if (rawPhone && !phone) {
    return { status: 'error', message: 'Số điện thoại Việt Nam không hợp lệ.' };
  }
  if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
    return { status: 'error', message: 'Ngày sinh không hợp lệ.' };
  }
  if (birthday && new Date(`${birthday}T00:00:00Z`) > new Date()) {
    return { status: 'error', message: 'Ngày sinh không thể ở tương lai.' };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, phone, birthday: birthday || null })
    .eq('id', profile.id);

  if (error) return { status: 'error', message: 'Không thể cập nhật hồ sơ lúc này.' };

  revalidatePath('/account');
  return { status: 'success', message: 'Đã cập nhật hồ sơ.' };
}
