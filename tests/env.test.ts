import assert from 'node:assert/strict';
import test from 'node:test';
import { assertProductionEnv, getAppMode } from '../lib/env.ts';

test('getAppMode defaults to demo', () => {
  assert.equal(getAppMode({}), 'demo');
});

test('assertProductionEnv rejects a production app without core configuration', () => {
  assert.throws(
    () => assertProductionEnv({ NEXT_PUBLIC_APP_MODE: 'production' }),
    /NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/
  );
});

test('assertProductionEnv requires Sepay secrets only when Sepay is enabled', () => {
  const coreEnv = {
    NEXT_PUBLIC_APP_MODE: 'production',
    NEXT_PUBLIC_SITE_URL: 'https://beanbus.vn',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-key',
  };

  assert.doesNotThrow(() => assertProductionEnv(coreEnv));
  assert.throws(
    () => assertProductionEnv({ ...coreEnv, NEXT_PUBLIC_ENABLE_SEPAY: 'true' }),
    /SUPABASE_SECRET_KEY, SEPAY_WEBHOOK_SECRET, SEPAY_BANK_CODE, SEPAY_BANK_ACCOUNT, SEPAY_ACCOUNT_NAME/
  );
});
