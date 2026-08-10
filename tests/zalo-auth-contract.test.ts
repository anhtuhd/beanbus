import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function source(path: string): Promise<string> {
  return readFile(new URL(path, root), 'utf8');
}

test('phone sign-in creates users explicitly and forwards Turnstile proof', async () => {
  const actions = await source('app/auth/actions.ts');

  assert.match(actions, /shouldCreateUser:\s*true/);
  assert.match(actions, /captchaToken:\s*captchaToken \|\| undefined/);
  assert.match(actions, /verifyOtp\(\{ phone, token, type: 'sms' \}\)/);
});

test('member phone changes use Supabase Auth rather than direct profile writes', async () => {
  const actions = await source('app/account/actions.ts');

  assert.match(actions, /auth\.updateUser\(\{ phone \}\)/);
  assert.match(actions, /auth\.resend\(\{ phone, type: 'phone_change' \}\)/);
  assert.match(actions, /type: 'phone_change'/);
  assert.doesNotMatch(actions, /\.update\(\{[^}]*phone/);
});

test('Zalo hook verifies Standard Webhooks and stays inside the provider timeout budget', async () => {
  const hook = await source('supabase/functions/send-zalo-otp/index.ts');

  assert.match(hook, /new Webhook\(hookSecret\)/);
  assert.match(hook, /webhook\.verify/);
  assert.match(hook, /ZALO_TIMEOUT_MS = 3_500/);
  assert.match(hook, /AbortSignal\.timeout\(ZALO_TIMEOUT_MS\)/);
  assert.match(hook, /TOKEN_LOOKUP_TIMEOUT_MS = 750/);

  const logArguments = [...hook.matchAll(/console\.(?:info|warn|error)\(([\s\S]*?)\);/g)]
    .map((match) => match[1].replace(/(['"])(?:\\.|(?!\1).)*\1/g, ''));
  for (const argumentsSource of logArguments) {
    assert.doesNotMatch(argumentsSource, /\b(?:otp|phone|accessToken)\b/);
  }
});

test('database migration limits phone and token mutations to trusted code', async () => {
  const migration = await source('supabase/migrations/20260810120000_zalo_otp_auth.sql');

  assert.match(migration, /revoke update \(phone\) on public\.profiles from authenticated/);
  assert.match(migration, /grant execute on function public\.get_zalo_access_token\(\) to service_role/);
  assert.match(migration, /phone_change_sent_at < now\(\) - interval '15 minutes'/);
  assert.match(migration, /beanbus-refresh-zalo-token/);
  assert.match(migration, /'17 \*\/12 \* \* \*'/);
});

test('refresh worker authenticates cron and releases a failed token lease', async () => {
  const worker = await source('supabase/functions/refresh-zalo-token/index.ts');

  assert.match(worker, /x-zalo-refresh-secret/);
  assert.match(worker, /claim_zalo_token_refresh/);
  assert.match(worker, /complete_zalo_token_refresh/);
  assert.match(worker, /release_zalo_token_refresh/);
  assert.match(worker, /grant_type: 'refresh_token'/);
  assert.doesNotMatch(worker, /console\.(?:info|warn|error)\([^)]*(?:accessToken|refreshToken)/);
});

test('Zalo UI keeps resend throttling and Google fallback visible', async () => {
  const login = await source('app/login/LoginForm.tsx');
  const resend = await source('app/auth/OtpResendButton.tsx');

  assert.match(resend, /OTP_RESEND_SECONDS = 60/);
  assert.match(login, /Nhận mã qua Zalo/);
  assert.match(login, /Tiếp tục với Google/);
  assert.match(resend, /formAction=\{action\}/);
});
