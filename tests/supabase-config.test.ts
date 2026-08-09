import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getOptionalSupabasePublicConfig,
  getSupabasePublicConfig,
} from '../lib/supabase/public-config.ts';
import { getSupabaseAdminConfig } from '../lib/supabase/admin-config.ts';
import { getSupabaseCookieOptions } from '../lib/supabase/cookie-options.ts';
import { createSupabaseServerClient } from '../lib/supabase/server-client.ts';

const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://beanbus.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
};

test('getSupabasePublicConfig returns validated public credentials', () => {
  assert.deepEqual(getSupabasePublicConfig(publicEnv), {
    url: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
});

test('getSupabasePublicConfig rejects missing and invalid values', () => {
  assert.throws(() => getSupabasePublicConfig({}), /NEXT_PUBLIC_SUPABASE_URL/);
  assert.throws(
    () => getSupabasePublicConfig({ ...publicEnv, NEXT_PUBLIC_SUPABASE_URL: 'not-a-url' }),
    /valid HTTP\(S\) URL/
  );
});

test('optional Supabase config allows a fully unconfigured demo only', () => {
  assert.equal(getOptionalSupabasePublicConfig({}), null);
  assert.throws(
    () =>
      getOptionalSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_URL: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      }),
    /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/
  );
});

test('getSupabaseAdminConfig requires a server-only secret key', () => {
  assert.deepEqual(
    getSupabaseAdminConfig({ ...publicEnv, SUPABASE_SECRET_KEY: 'sb_secret_example' }),
    {
      url: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      secretKey: 'sb_secret_example',
    }
  );
  assert.throws(() => getSupabaseAdminConfig(publicEnv), /SUPABASE_SECRET_KEY/);
});

test('Supabase auth cookies are same-site and secure in production', () => {
  assert.deepEqual(getSupabaseCookieOptions('production'), {
    path: '/',
    sameSite: 'lax',
    secure: true,
    httpOnly: false,
  });
  assert.equal(getSupabaseCookieOptions('development').secure, false);
});

test('server client constructs with validated public config and a cookie adapter', () => {
  const client = createSupabaseServerClient(getSupabasePublicConfig(publicEnv), {
    getAll: () => [],
    setAll: () => undefined,
  });

  assert.ok(client.auth);
});
