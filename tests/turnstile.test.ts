import assert from 'node:assert/strict';
import test from 'node:test';
import { isFormCaptchaEnabled, verifyFormCaptcha, verifyTurnstileToken } from '../lib/security/turnstile.ts';

test('form captcha is disabled by default without calling Cloudflare', async () => {
  assert.equal(isFormCaptchaEnabled({}), false);
  assert.deepEqual(await verifyFormCaptcha({}), { ok: true });
});

test('Turnstile token validation sends the server secret only to Siteverify and fails closed', async () => {
  let receivedBody = '';
  const fetchImpl: typeof fetch = async (_input, init) => {
    receivedBody = String(init?.body ?? '');
    return new Response(JSON.stringify({ success: false, 'error-codes': ['timeout-or-duplicate'] }), { status: 200 });
  };

  assert.equal(
    await verifyTurnstileToken('expired-token', {
      env: { TURNSTILE_SECRET_KEY: 'turnstile-secret-123456' },
      fetchImpl,
    }),
    false,
  );
  assert.match(receivedBody, /"response":"expired-token"/);
  assert.match(receivedBody, /turnstile-secret-123456/);
});

test('successful Turnstile validation accepts only a successful Siteverify response', async () => {
  const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ success: true }), { status: 200 });
  assert.equal(
    await verifyTurnstileToken('valid-token', {
      env: { TURNSTILE_SECRET_KEY: 'turnstile-secret-123456' },
      fetchImpl,
    }),
    true,
  );
});
