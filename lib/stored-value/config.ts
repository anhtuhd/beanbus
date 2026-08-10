export function isStoredValueConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return env.NEXT_PUBLIC_APP_MODE === 'production'
    && env.NEXT_PUBLIC_ENABLE_STORED_VALUE === 'true'
    && env.NEXT_PUBLIC_ENABLE_SEPAY === 'true';
}
