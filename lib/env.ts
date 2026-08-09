type Environment = Record<string, string | undefined>;

const CORE_PRODUCTION_KEYS = [
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
] as const;

const SEPAY_KEYS = [
  'SEPAY_API_KEY',
  'SEPAY_WEBHOOK_SECRET',
  'SEPAY_BANK_CODE',
  'SEPAY_BANK_ACCOUNT',
  'SEPAY_ACCOUNT_NAME',
] as const;

export type AppMode = 'demo' | 'production';

export function getAppMode(env: Environment = process.env): AppMode {
  return env.NEXT_PUBLIC_APP_MODE === 'production' ? 'production' : 'demo';
}

export function assertProductionEnv(env: Environment = process.env): void {
  if (getAppMode(env) !== 'production') return;

  const requiredKeys = env.NEXT_PUBLIC_ENABLE_SEPAY === 'true'
    ? [...CORE_PRODUCTION_KEYS, ...SEPAY_KEYS]
    : CORE_PRODUCTION_KEYS;
  const missing = requiredKeys.filter((key) => !env[key]?.trim());

  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
}
