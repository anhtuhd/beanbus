const FID_PATTERN = /^[A-Za-z0-9_-]{20,256}$/;
const SAFE_NOTIFICATION_PATHS = [
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

export type PushInstallationInput = {
  fid: string;
  locale: 'en' | 'vi';
};

export type ValidationResult<T> =
  | { data: T; ok: true }
  | { error: string; ok: false };

export function isTrustedMutationOrigin(origin: string | null, configuredSiteUrl: string): boolean {
  if (!origin) return false;
  try {
    const actual = new URL(origin);
    const expected = new URL(configuredSiteUrl);
    return ['http:', 'https:'].includes(actual.protocol) && actual.origin === expected.origin;
  } catch {
    return false;
  }
}

export function parsePushInstallationInput(input: unknown): ValidationResult<PushInstallationInput> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'INVALID_BODY' };
  }
  const record = input as Record<string, unknown>;
  const fid = typeof record.fid === 'string' ? record.fid.trim() : '';
  const rawLocale = typeof record.locale === 'string' ? record.locale.toLowerCase() : '';
  const locale = rawLocale === 'vi' || rawLocale.startsWith('vi-')
    ? 'vi'
    : rawLocale === 'en' || rawLocale.startsWith('en-')
      ? 'en'
      : null;

  if (!FID_PATTERN.test(fid) || !locale) return { ok: false, error: 'INVALID_INSTALLATION' };
  return { ok: true, data: { fid, locale } };
}

export function isSafeNotificationHref(href: string): boolean {
  if (!href.startsWith('/') || href.startsWith('//') || href.includes('\\')) return false;
  try {
    const url = new URL(href, 'https://beanbus.invalid');
    return url.origin === 'https://beanbus.invalid'
      && SAFE_NOTIFICATION_PATHS.some((prefix) =>
        url.pathname === prefix || (prefix !== '/' && url.pathname.startsWith(`${prefix}/`)));
  } catch {
    return false;
  }
}
