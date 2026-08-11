type Environment = Record<string, string | undefined>;

const CORE_PRODUCTION_KEYS = [
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
] as const;

const SEPAY_KEYS = [
  'SUPABASE_SECRET_KEY',
  'SEPAY_WEBHOOK_SECRET',
  'SEPAY_BANK_CODE',
  'SEPAY_BANK_ACCOUNT',
  'SEPAY_ACCOUNT_NAME',
] as const;

const SEPAY_RECONCILIATION_KEYS = ['SEPAY_API_KEY', 'CRON_SECRET'] as const;

const PHONE_AUTH_KEYS = ['NEXT_PUBLIC_TURNSTILE_SITE_KEY'] as const;
const FORM_CAPTCHA_KEYS = ['NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY'] as const;

export type AppMode = 'demo' | 'production';

export function getAppMode(env: Environment = process.env): AppMode {
  return env.NEXT_PUBLIC_APP_MODE === 'production' ? 'production' : 'demo';
}

export function getSiteUrl(env: Environment = process.env): string {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://beanbus.vn';
  const url = new URL(configured);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Site URL must use HTTP or HTTPS.');
  return url.origin;
}

export function assertProductionEnv(env: Environment = process.env): void {
  if (getAppMode(env) !== 'production') return;
  if (env.NEXT_PUBLIC_ENABLE_SEPAY_RECONCILIATION === 'true' && env.NEXT_PUBLIC_ENABLE_SEPAY !== 'true') {
    throw new Error('NEXT_PUBLIC_ENABLE_SEPAY_RECONCILIATION requires NEXT_PUBLIC_ENABLE_SEPAY=true');
  }

  const requiredKeys = [
    ...CORE_PRODUCTION_KEYS,
    ...(env.NEXT_PUBLIC_ENABLE_SEPAY === 'true' ? SEPAY_KEYS : []),
    ...(env.NEXT_PUBLIC_ENABLE_SEPAY_RECONCILIATION === 'true' ? SEPAY_RECONCILIATION_KEYS : []),
    ...(env.NEXT_PUBLIC_ENABLE_PHONE_AUTH === 'true' ? PHONE_AUTH_KEYS : []),
    ...(env.NEXT_PUBLIC_ENABLE_FORM_CAPTCHA === 'true' ? FORM_CAPTCHA_KEYS : []),
  ];
  const missing = requiredKeys.filter((key) => !env[key]?.trim());

  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
  getSiteUrl(env);
}
