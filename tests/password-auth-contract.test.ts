import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const actions = readFileSync('app/auth/actions.ts', 'utf8');
const loginPage = readFileSync('app/login/page.tsx', 'utf8');
const loginForm = readFileSync('app/login/LoginForm.tsx', 'utf8');
const envExample = readFileSync('.env.example', 'utf8');

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
