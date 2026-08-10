'use server';

import { redirect } from 'next/navigation';
import { normalizeVietnameseMobile, safeRedirectPath } from '@/lib/auth/input';
import { resolveAuthOrigin } from '@/lib/auth/origin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { PhoneAuthState } from './phone-state';

function providerEnabled(name: 'PHONE' | 'GOOGLE'): boolean {
  return process.env[`NEXT_PUBLIC_ENABLE_${name}_AUTH`] === 'true';
}

function authFailureMessage(): string {
  return 'Không thể xác thực lúc này. Vui lòng kiểm tra thông tin hoặc thử lại sau.';
}

export async function requestPhoneOtp(
  _previousState: PhoneAuthState,
  formData: FormData
): Promise<PhoneAuthState> {
  if (!providerEnabled('PHONE')) {
    return { status: 'error', message: 'Đăng nhập bằng Zalo chưa được cấu hình.' };
  }
  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    return { status: 'error', message: 'Xác minh bảo mật cho đăng nhập Zalo chưa được cấu hình.' };
  }

  const phone = normalizeVietnameseMobile(String(formData.get('phone') ?? ''));
  const captchaToken = String(formData.get('cf-turnstile-response') ?? '').trim();
  if (!phone) {
    return { status: 'error', message: 'Số điện thoại Việt Nam không hợp lệ.' };
  }
  if (!captchaToken) {
    return { status: 'error', message: 'Vui lòng hoàn tất bước xác minh bảo mật.', phone };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: {
      shouldCreateUser: true,
      captchaToken: captchaToken || undefined,
    },
  });

  if (error) return { status: 'error', message: authFailureMessage(), phone };

  return { status: 'code-sent', phone, requestId: crypto.randomUUID() };
}

export async function verifyPhoneOtp(
  _previousState: PhoneAuthState,
  formData: FormData
): Promise<PhoneAuthState> {
  if (!providerEnabled('PHONE')) {
    return { status: 'error', message: 'Đăng nhập bằng Zalo chưa được cấu hình.' };
  }

  const phone = normalizeVietnameseMobile(String(formData.get('phone') ?? ''));
  const token = String(formData.get('token') ?? '').trim();
  const next = safeRedirectPath(formData.get('next'));

  if (!phone || !/^\d{6}$/.test(token)) {
    return { status: 'error', message: 'Số điện thoại hoặc mã OTP không hợp lệ.', phone: phone ?? undefined };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });

  if (error) return { status: 'error', message: authFailureMessage(), phone };

  redirect(next);
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  if (!providerEnabled('GOOGLE')) redirect('/login?error=google_not_configured');

  const next = safeRedirectPath(formData.get('next'));
  const siteUrl = resolveAuthOrigin({ configuredUrl: process.env.NEXT_PUBLIC_SITE_URL });
  if (!siteUrl) redirect('/login?error=auth_config_error');

  const callbackUrl = new URL('/auth/callback', siteUrl);
  callbackUrl.searchParams.set('next', next);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl.toString(),
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) redirect('/login?error=oauth_start_failed');

  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect('/');
}
