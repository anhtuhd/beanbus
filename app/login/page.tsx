import { redirect } from 'next/navigation';
import LoginForm from './LoginForm';
import { getAppMode } from '@/lib/env';
import { getCurrentProfile } from '@/lib/auth/session';
import { safeRedirectPath } from '@/lib/auth/input';
import { resolvePostAuthPath } from '@/lib/auth/redirect';

const AUTH_ERRORS: Record<string, string> = {
  google_not_configured: 'Đăng nhập Google chưa được cấu hình.',
  auth_config_error: 'Cấu hình địa chỉ đăng nhập chưa hợp lệ.',
  oauth_start_failed: 'Không thể bắt đầu đăng nhập Google.',
  oauth_callback_failed: 'Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn.',
  profile_unavailable: 'Không thể tải quyền tài khoản. Vui lòng đăng nhập lại.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const next = safeRedirectPath(typeof query.next === 'string' ? query.next : null);

  if (getAppMode() === 'demo') redirect('/account');

  const profile = await getCurrentProfile();
  if (profile) redirect(resolvePostAuthPath(profile.role, next));

  const errorCode = typeof query.error === 'string' ? query.error : '';
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  return (
    <LoginForm
      next={next}
      passwordEnabled={process.env.NEXT_PUBLIC_ENABLE_PASSWORD_AUTH === 'true'}
      phoneEnabled={process.env.NEXT_PUBLIC_ENABLE_PHONE_AUTH === 'true' && Boolean(turnstileSiteKey)}
      googleEnabled={process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === 'true'}
      turnstileSiteKey={turnstileSiteKey}
      errorMessage={AUTH_ERRORS[errorCode]}
    />
  );
}
