import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const actions = readFileSync('app/auth/actions.ts', 'utf8');
const callback = readFileSync('app/auth/callback/route.ts', 'utf8');
const login = readFileSync('app/login/page.tsx', 'utf8');

test('Google login is provider-gated and uses a local safe callback', () => {
  assert.match(actions, /NEXT_PUBLIC_ENABLE_\$\{name\}_AUTH/);
  assert.match(actions, /provider: 'google'/);
  assert.match(actions, /redirectTo: callbackUrl\.toString\(\)/);
  assert.match(actions, /skipBrowserRedirect: true/);
  assert.match(actions, /callbackUrl\.searchParams\.set\('next', next\)/);
  assert.match(actions, /safeRedirectPath\(formData\.get\('next'\)\)/);
  assert.match(login, /NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === 'true'/);
});

test('OAuth callback exchanges the code before redirecting', () => {
  assert.match(callback, /safeRedirectPath\(requestUrl\.searchParams\.get\('next'\)\)/);
  assert.match(callback, /exchangeCodeForSession\(code\)/);
  assert.match(callback, /oauth_callback_failed/);
  assert.match(callback, /new URL\(next, siteUrl\)/);
});
