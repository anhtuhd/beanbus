import assert from 'node:assert/strict';
import test from 'node:test';
import { assertProductionEnv, getAppMode, getDeploymentRevision, getSiteUrl } from '../lib/env.ts';

test('getAppMode defaults to demo', () => {
  assert.equal(getAppMode({}), 'demo');
});

test('getDeploymentRevision exposes only a bounded Vercel commit SHA', () => {
  assert.equal(getDeploymentRevision({ VERCEL_GIT_COMMIT_SHA: 'abcdef1234567890' }), 'abcdef123456');
  assert.equal(getDeploymentRevision({ VERCEL_GIT_COMMIT_SHA: 'not-a-sha' }), undefined);
  assert.equal(getDeploymentRevision({ VERCEL_GIT_COMMIT_SHA: 'a'.repeat(41) }), undefined);
});

test('getSiteUrl returns a validated origin without paths', () => {
  assert.equal(getSiteUrl({ NEXT_PUBLIC_SITE_URL: 'https://beanbus.vn/path' }), 'https://beanbus.vn');
  assert.equal(getSiteUrl({}), 'https://beanbus.vn');
  assert.throws(() => getSiteUrl({ NEXT_PUBLIC_SITE_URL: 'javascript:alert(1)' }), /HTTP/);
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

test('assertProductionEnv requires a recovery secret when password auth is enabled', () => {
  const coreEnv = {
    NEXT_PUBLIC_APP_MODE: 'production',
    NEXT_PUBLIC_SITE_URL: 'https://beanbus.vn',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-key',
    NEXT_PUBLIC_ENABLE_PASSWORD_AUTH: 'true',
  };

  assert.throws(() => assertProductionEnv(coreEnv), /PASSWORD_RECOVERY_SECRET/);
  assert.doesNotThrow(() => assertProductionEnv({
    ...coreEnv,
    PASSWORD_RECOVERY_SECRET: 'password-recovery-secret-123456',
  }));
});

test('assertProductionEnv requires a Turnstile site key when phone auth is enabled', () => {
  const coreEnv = {
    NEXT_PUBLIC_APP_MODE: 'production',
    NEXT_PUBLIC_SITE_URL: 'https://beanbus.vn',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-key',
  };

  assert.throws(
    () => assertProductionEnv({ ...coreEnv, NEXT_PUBLIC_ENABLE_PHONE_AUTH: 'true' }),
    /NEXT_PUBLIC_TURNSTILE_SITE_KEY/
  );
  assert.doesNotThrow(() => assertProductionEnv({
    ...coreEnv,
    NEXT_PUBLIC_ENABLE_PHONE_AUTH: 'true',
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'turnstile-site-key',
  }));
});

test('assertProductionEnv requires both Turnstile keys when anonymous form captcha is enabled', () => {
  const coreEnv = {
    NEXT_PUBLIC_APP_MODE: 'production',
    NEXT_PUBLIC_SITE_URL: 'https://beanbus.vn',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-key',
    NEXT_PUBLIC_ENABLE_FORM_CAPTCHA: 'true',
  };

  assert.throws(
    () => assertProductionEnv(coreEnv),
    /NEXT_PUBLIC_TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY/
  );
  assert.doesNotThrow(() => assertProductionEnv({
    ...coreEnv,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'turnstile-site-key',
    TURNSTILE_SECRET_KEY: 'turnstile-secret-123456',
  }));
});

test('assertProductionEnv requires SePay reconciliation credentials only when enabled', () => {
  const coreEnv = {
    NEXT_PUBLIC_APP_MODE: 'production',
    NEXT_PUBLIC_SITE_URL: 'https://beanbus.vn',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-key',
  };

  assert.doesNotThrow(() => assertProductionEnv({
    ...coreEnv,
    NEXT_PUBLIC_ENABLE_SEPAY_RECONCILIATION: 'false',
  }));
  assert.throws(
    () => assertProductionEnv({ ...coreEnv, NEXT_PUBLIC_ENABLE_SEPAY_RECONCILIATION: 'true' }),
    /requires NEXT_PUBLIC_ENABLE_SEPAY=true/
  );
  assert.throws(
    () => assertProductionEnv({
      ...coreEnv,
      NEXT_PUBLIC_ENABLE_SEPAY: 'true',
      NEXT_PUBLIC_ENABLE_SEPAY_RECONCILIATION: 'true',
      SUPABASE_SECRET_KEY: 'sb_secret_test',
      SEPAY_WEBHOOK_SECRET: 'sepay-webhook-secret',
      SEPAY_BANK_CODE: 'MB',
      SEPAY_BANK_ACCOUNT: '0937936688',
      SEPAY_ACCOUNT_NAME: 'BEANBUS',
    }),
    /SEPAY_API_KEY, CRON_SECRET/
  );
  assert.doesNotThrow(() => assertProductionEnv({
    ...coreEnv,
    NEXT_PUBLIC_ENABLE_SEPAY: 'true',
    NEXT_PUBLIC_ENABLE_SEPAY_RECONCILIATION: 'true',
    SUPABASE_SECRET_KEY: 'sb_secret_test',
    SEPAY_WEBHOOK_SECRET: 'sepay-webhook-secret',
    SEPAY_BANK_CODE: 'MB',
    SEPAY_BANK_ACCOUNT: '0937936688',
    SEPAY_ACCOUNT_NAME: 'BEANBUS',
    SEPAY_API_KEY: 'sepay-api-token-123456',
    CRON_SECRET: 'cron-secret-123456',
  }));
});

test('guest notifications require server-only cookie and Supabase credentials', () => {
  const coreEnv = {
    NEXT_PUBLIC_APP_MODE: 'production',
    NEXT_PUBLIC_SITE_URL: 'https://www.beanbus.store',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-key',
    NEXT_PUBLIC_ENABLE_NOTIFICATIONS: 'true',
    NEXT_PUBLIC_ENABLE_GUEST_NOTIFICATIONS: 'true',
  };

  assert.throws(() => assertProductionEnv(coreEnv), /GUEST_NOTIFICATION_SECRET, SUPABASE_SECRET_KEY/);
  assert.doesNotThrow(() => assertProductionEnv({
    ...coreEnv,
    GUEST_NOTIFICATION_SECRET: 'guest-secret-at-least-32-characters-long',
    SUPABASE_SECRET_KEY: 'sb_secret_test',
  }));
});

test('web push requires notifications and complete public Firebase configuration', () => {
  const coreEnv = {
    NEXT_PUBLIC_APP_MODE: 'production',
    NEXT_PUBLIC_SITE_URL: 'https://www.beanbus.store',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-key',
    NEXT_PUBLIC_ENABLE_WEB_PUSH: 'true',
  };

  assert.throws(() => assertProductionEnv(coreEnv), /requires NEXT_PUBLIC_ENABLE_NOTIFICATIONS=true/);
  assert.throws(() => assertProductionEnv({
    ...coreEnv,
    NEXT_PUBLIC_ENABLE_NOTIFICATIONS: 'true',
  }), /NEXT_PUBLIC_FIREBASE_API_KEY/);
  assert.doesNotThrow(() => assertProductionEnv({
    ...coreEnv,
    NEXT_PUBLIC_ENABLE_NOTIFICATIONS: 'true',
    NEXT_PUBLIC_FIREBASE_API_KEY: 'firebase-api-key',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'beanbus.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'beanbus',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789',
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456789:web:abc123',
    NEXT_PUBLIC_FIREBASE_VAPID_KEY: 'vapid-public-key',
  }));
});

test('R2 media requires server credentials only when enabled', () => {
  const coreEnv = {
    NEXT_PUBLIC_APP_MODE: 'production',
    NEXT_PUBLIC_SITE_URL: 'https://www.beanbus.store',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-key',
  };

  assert.doesNotThrow(() => assertProductionEnv(coreEnv));
  assert.throws(() => assertProductionEnv({ ...coreEnv, NEXT_PUBLIC_ENABLE_R2_MEDIA: 'true' }), /R2_ACCOUNT_ID/);
  assert.doesNotThrow(() => assertProductionEnv({
    ...coreEnv,
    NEXT_PUBLIC_ENABLE_R2_MEDIA: 'true',
    NEXT_PUBLIC_R2_PUBLIC_BASE_URL: 'https://images.beanbus.store',
    R2_ACCOUNT_ID: 'account',
    R2_BUCKET_NAME: 'beanbus-media',
    R2_ACCESS_KEY_ID: 'access',
    R2_SECRET_ACCESS_KEY: 'secret',
  }));
});
