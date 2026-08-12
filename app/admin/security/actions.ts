'use server';

import { resolveAuthOrigin } from '@/lib/auth/origin';
import {
  PASSWORD_RECOVERY_COOKIE,
  verifyRecoveryCapability,
} from '@/lib/auth/password-recovery';
import { requireAdmin } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import type { PasswordManagementState } from './security-state';

const MIN_PASSWORD_LENGTH = 12;
const GENERIC_PASSWORD_ERROR = 'Không thể cập nhật mật khẩu. Vui lòng kiểm tra thông tin và thử lại.';

function validatePasswordPair(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 128) {
    return `Mật khẩu cần có từ ${MIN_PASSWORD_LENGTH} đến 128 ký tự.`;
  }
  if (password !== confirmation) return 'Mật khẩu xác nhận không khớp.';
  return null;
}

export async function updateAdminPassword(
  _previousState: PasswordManagementState,
  formData: FormData
): Promise<PasswordManagementState> {
  const profile = await requireAdmin();

  const password = String(formData.get('password') ?? '');
  const confirmation = String(formData.get('passwordConfirmation') ?? '');
  const currentPassword = String(formData.get('currentPassword') ?? '');
  const recoveryRequested = formData.get('recovery') === 'true';
  const recoveryCookie = (await cookies()).get(PASSWORD_RECOVERY_COOKIE)?.value;
  const recovery = recoveryRequested && await verifyRecoveryCapability(recoveryCookie, profile.id);
  const validationError = validatePasswordPair(password, confirmation);

  if (validationError) return { status: 'error', message: validationError };
  if (recoveryRequested && !recovery) return { status: 'error', message: GENERIC_PASSWORD_ERROR };
  if (!recovery && currentPassword.length === 0) {
    return { status: 'error', message: 'Vui lòng nhập mật khẩu hiện tại.' };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser(
    recovery
      ? { password }
      : { password, current_password: currentPassword }
  );

  if (error) return { status: 'error', message: GENERIC_PASSWORD_ERROR };
  if (recovery) (await cookies()).delete({ name: PASSWORD_RECOVERY_COOKIE, path: '/admin/security' });
  return { status: 'success', message: 'Đã cập nhật mật khẩu.' };
}

export async function requestAdminPasswordReset(
  _previousState: PasswordManagementState,
  _formData: FormData
): Promise<PasswordManagementState> {
  void _previousState;
  void _formData;
  const profile = await requireAdmin();
  const siteUrl = resolveAuthOrigin({ configuredUrl: process.env.NEXT_PUBLIC_SITE_URL });
  if (!siteUrl || !profile.email) {
    return { status: 'error', message: 'Chưa thể gửi email đặt lại mật khẩu lúc này.' };
  }

  const redirectTo = new URL('/auth/callback', siteUrl).toString();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(profile.email, { redirectTo });
  if (error) return { status: 'error', message: 'Chưa thể gửi email đặt lại mật khẩu lúc này.' };

  return { status: 'success', message: 'Đã gửi email đặt lại mật khẩu. Hãy kiểm tra hộp thư của admin.' };
}
