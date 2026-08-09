const VIETNAMESE_MOBILE = /^(?:\+84|0)([35789]\d{8})$/;

export function normalizeVietnameseMobile(value: string): string | null {
  const compact = value.trim().replace(/[\s().-]/g, '');
  const match = compact.match(VIETNAMESE_MOBILE);

  return match ? `+84${match[1]}` : null;
}

export function safeRedirectPath(
  value: FormDataEntryValue | null,
  fallback = '/account'
): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }

  if (value.includes('\\')) return fallback;

  try {
    const parsed = new URL(value, 'https://beanbus.local');
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return fallback;
  }
}
