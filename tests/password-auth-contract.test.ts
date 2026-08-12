import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const actions = readFileSync('app/auth/actions.ts', 'utf8');
const loginPage = readFileSync('app/login/page.tsx', 'utf8');
const loginForm = readFileSync('app/login/LoginForm.tsx', 'utf8');
const envExample = readFileSync('.env.example', 'utf8');
const adminSecurityActions = readFileSync('app/admin/security/actions.ts', 'utf8');
const authCallback = readFileSync('app/auth/callback/route.ts', 'utf8');

test('password auth is provider-gated and role-resolved on the server', () => {
  assert.match(actions, /signInWithPassword/);
  assert.match(actions, /supabase\.auth\.getClaims\(\)/);
  assert.match(actions, /from\('profiles'\)\.select\('role'\)/);
  assert.match(actions, /resolvePostAuthPath\(profile\.role, next\)/);
  assert.match(actions, /authFailureMessage\(\)/);
  assert.doesNotMatch(actions, /user_metadata/);
});

test('password login is explicitly feature-gated in the page and form', () => {
  assert.match(loginPage, /NEXT_PUBLIC_ENABLE_PASSWORD_AUTH === 'true'/);
  assert.match(loginPage, /passwordEnabled/);
  assert.match(loginForm, /signInWithPassword/);
  assert.match(loginForm, /passwordEnabled/);
});

test('password auth has an explicit environment switch', () => {
  assert.match(envExample, /^NEXT_PUBLIC_ENABLE_PASSWORD_AUTH=false$/m);
});

test('admin password management uses Supabase Auth and keeps recovery admin-only', () => {
  assert.match(adminSecurityActions, /await requireAdmin\(\)/g);
  assert.match(adminSecurityActions, /supabase\.auth\.updateUser/);
  assert.match(adminSecurityActions, /current_password/);
  assert.match(adminSecurityActions, /resetPasswordForEmail/);
  assert.match(adminSecurityActions, /PASSWORD_RECOVERY_COOKIE/);
  assert.match(adminSecurityActions, /recoveryRequested && !recovery/);
  assert.match(adminSecurityActions, /resetPasswordForEmail\(profile\.email, \{ redirectTo \}\)/);
  assert.doesNotMatch(adminSecurityActions, /supabase\.from\(['"]profiles['"]\)\.update/);
  assert.match(authCallback, /redirectType === 'recovery'/);
  assert.match(authCallback, /\/admin\/security\?recovery=1/);
  assert.match(authCallback, /httpOnly: true/);
  assert.match(authCallback, /PASSWORD_RECOVERY_MAX_AGE/);
  assert.match(authCallback, /profile\.role === 'admin'/);
  assert.match(authCallback, /createRecoveryCapability\(exchangeData\.user\.id\)/);
  assert.match(adminSecurityActions, /verifyRecoveryCapability\(recoveryCookie, profile\.id\)/);
});

test('password recovery trusts Supabase redirect type and clears its scoped capability cookie', () => {
  assert.match(authCallback, /const \{ data: exchangeData, error \} = await supabase\.auth\.exchangeCodeForSession\(code\)/);
  assert.match(authCallback, /redirectType === 'recovery'/);
  assert.doesNotMatch(authCallback, /requestUrl\.searchParams\.get\('flow'\) === 'recovery'/);
  assert.match(adminSecurityActions, /cookies\(\)\)\.delete\(\{ name: PASSWORD_RECOVERY_COOKIE, path: '\/admin\/security' \}\)/);
});
