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
const PASSWORD_AUTH_KEYS = ['PASSWORD_RECOVERY_SECRET'] as const;
const GUEST_NOTIFICATION_KEYS = ['GUEST_NOTIFICATION_SECRET', 'SUPABASE_SECRET_KEY'] as const;
const WEB_PUSH_KEYS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_FIREBASE_VAPID_KEY',
] as const;
const R2_MEDIA_KEYS = [
  'R2_ACCOUNT_ID',
  'R2_BUCKET_NAME',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'NEXT_PUBLIC_R2_PUBLIC_BASE_URL',
] as const;

export type AppMode = 'demo' | 'production';

export function getAppMode(env: Environment = process.env): AppMode {
  return env.NEXT_PUBLIC_APP_MODE === 'production' ? 'production' : 'demo';
}

export function getDeploymentRevision(env: Environment = process.env): string | undefined {
  const revision = env.VERCEL_GIT_COMMIT_SHA?.trim();
  return revision && /^[0-9a-f]{7,40}$/i.test(revision) ? revision.slice(0, 12) : undefined;
}

export function isNotificationsEnabled(env: Environment = process.env): boolean {
  return env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS === 'true';
}

export function getSiteUrl(env: Environment = process.env): string {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://beanbus.vn';
  const url = new URL(configured);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Site URL must use HTTP or HTTPS.');
  return url.origin;
}

export function assertProductionEnv(env: Environment = process.env): void {
  if (getAppMode(env) !== 'production') return;
  if (env.CATALOG_MENU_MODE && !['legacy', 'scheduled'].includes(env.CATALOG_MENU_MODE)) {
    throw new Error('CATALOG_MENU_MODE must be legacy or scheduled');
  }
  if (env.NEXT_PUBLIC_ENABLE_SEPAY_RECONCILIATION === 'true' && env.NEXT_PUBLIC_ENABLE_SEPAY !== 'true') {
    throw new Error('NEXT_PUBLIC_ENABLE_SEPAY_RECONCILIATION requires NEXT_PUBLIC_ENABLE_SEPAY=true');
  }
  if ((env.NEXT_PUBLIC_ENABLE_GUEST_NOTIFICATIONS === 'true' || env.NEXT_PUBLIC_ENABLE_WEB_PUSH === 'true')
    && env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS !== 'true') {
    throw new Error('NEXT_PUBLIC_ENABLE_GUEST_NOTIFICATIONS or NEXT_PUBLIC_ENABLE_WEB_PUSH requires NEXT_PUBLIC_ENABLE_NOTIFICATIONS=true');
  }

  const requiredKeys = [
    ...CORE_PRODUCTION_KEYS,
    ...(env.NEXT_PUBLIC_ENABLE_SEPAY === 'true' ? SEPAY_KEYS : []),
    ...(env.NEXT_PUBLIC_ENABLE_SEPAY_RECONCILIATION === 'true' ? SEPAY_RECONCILIATION_KEYS : []),
    ...(env.NEXT_PUBLIC_ENABLE_PHONE_AUTH === 'true' ? PHONE_AUTH_KEYS : []),
    ...(env.NEXT_PUBLIC_ENABLE_FORM_CAPTCHA === 'true' ? FORM_CAPTCHA_KEYS : []),
    ...(env.NEXT_PUBLIC_ENABLE_PASSWORD_AUTH === 'true' ? PASSWORD_AUTH_KEYS : []),
    ...(env.NEXT_PUBLIC_ENABLE_GUEST_NOTIFICATIONS === 'true' ? GUEST_NOTIFICATION_KEYS : []),
    ...(env.NEXT_PUBLIC_ENABLE_WEB_PUSH === 'true' ? WEB_PUSH_KEYS : []),
    ...(env.NEXT_PUBLIC_ENABLE_R2_MEDIA === 'true' ? R2_MEDIA_KEYS : []),
  ];
  const missing = requiredKeys.filter((key) => !env[key]?.trim());

  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
  getSiteUrl(env);
}
