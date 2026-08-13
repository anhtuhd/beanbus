const UNREGISTERED_CODES = new Set([
  'messaging/installation-id-not-registered',
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

const TRANSIENT_CODES = new Set([
  'messaging/device-message-rate-exceeded',
  'messaging/internal-error',
  'messaging/message-rate-exceeded',
  'messaging/quota-exceeded',
  'messaging/server-unavailable',
  'messaging/unknown-error',
]);

const SAFE_FCM_PATHS = [
  '/',
  '/about',
  '/account',
  '/admin/orders',
  '/admin/requests',
  '/blog',
  '/contact',
  '/events',
  '/menu',
  '/notifications',
  '/order/guest',
] as const;

export function classifyFcmErrorCode(code: string): { retryable: boolean; safeCode: string } {
  if (UNREGISTERED_CODES.has(code)) return { retryable: false, safeCode: 'UNREGISTERED' };
  if (TRANSIENT_CODES.has(code)) return { retryable: true, safeCode: code };
  return { retryable: false, safeCode: 'FCM_REJECTED' };
}

export function normalizeFcmHref(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return null;
  }
  try {
    const url = new URL(value, 'https://beanbus.invalid');
    const allowed = url.origin === 'https://beanbus.invalid' && SAFE_FCM_PATHS.some((prefix) =>
      url.pathname === prefix || (prefix !== '/' && url.pathname.startsWith(`${prefix}/`)));
    return allowed ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}
