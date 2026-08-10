'use server';

import { revalidatePath } from 'next/cache';
import { normalizeVietnameseMobile } from '@/lib/auth/input';
import { getCurrentProfile } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { MemberPhoneState } from './phone-state';
import type { ProfileUpdateState } from './profile-state';

export async function updateMemberProfile(
  _previousState: ProfileUpdateState,
  formData: FormData
): Promise<ProfileUpdateState> {
  const profile = await getCurrentProfile();
  if (!profile) return { status: 'error', message: 'Phiên đăng nhập đã hết hạn.' };

  const fullName = String(formData.get('fullName') ?? '').trim();
  const birthday = String(formData.get('birthday') ?? '').trim();

  if (fullName.length < 2 || fullName.length > 100) {
    return { status: 'error', message: 'Họ tên cần có từ 2 đến 100 ký tự.' };
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
    .update({ full_name: fullName, birthday: birthday || null })
    .eq('id', profile.id);

  if (error) return { status: 'error', message: 'Không thể cập nhật hồ sơ lúc này.' };

  revalidatePath('/account');
  return { status: 'success', message: 'Đã cập nhật hồ sơ.' };
}

export async function requestMemberPhoneOtp(
  _previousState: MemberPhoneState,
  formData: FormData
): Promise<MemberPhoneState> {
  if (process.env.NEXT_PUBLIC_ENABLE_PHONE_AUTH !== 'true') {
    return { status: 'error', message: 'Xác minh số qua Zalo chưa được cấu hình.' };
  }

  const profile = await getCurrentProfile();
  if (!profile) return { status: 'error', message: 'Phiên đăng nhập đã hết hạn.' };

  const phone = normalizeVietnameseMobile(String(formData.get('phone') ?? ''));
  if (!phone) {
    return { status: 'error', message: 'Số điện thoại Việt Nam không hợp lệ.' };
  }

  const supabase = await createServerSupabaseClient();
  const isPhoneChangeResend = formData.get('otpIntent') === 'phone_change';
  const { error } = isPhoneChangeResend
    ? await supabase.auth.resend({ phone, type: 'phone_change' })
    : await supabase.auth.updateUser({ phone });

  if (error) {
    return {
      status: 'error',
      message: 'Không thể liên kết số này. Vui lòng dùng số khác hoặc thử lại sau.',
    };
  }

  return { status: 'code-sent', phone, requestId: crypto.randomUUID() };
}

export async function verifyMemberPhoneOtp(
  _previousState: MemberPhoneState,
  formData: FormData
): Promise<MemberPhoneState> {
  if (process.env.NEXT_PUBLIC_ENABLE_PHONE_AUTH !== 'true') {
    return { status: 'error', message: 'Xác minh số qua Zalo chưa được cấu hình.' };
  }

  const profile = await getCurrentProfile();
  if (!profile) return { status: 'error', message: 'Phiên đăng nhập đã hết hạn.' };

  const phone = normalizeVietnameseMobile(String(formData.get('phone') ?? ''));
  const token = String(formData.get('token') ?? '').trim();
  if (!phone || !/^\d{6}$/.test(token)) {
    return { status: 'error', message: 'Số điện thoại hoặc mã OTP không hợp lệ.', phone: phone ?? undefined };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'phone_change' });
  if (error) {
    return {
      status: 'error',
      message: 'Không thể xác minh số này. Mã có thể đã hết hạn hoặc không hợp lệ.',
      phone,
    };
  }

  revalidatePath('/account');
  return { status: 'success', message: 'Số điện thoại đã được xác minh.', phone };
}
