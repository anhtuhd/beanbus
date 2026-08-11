import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const actionSources = [
  readFileSync(new URL('../app/booking/actions.ts', import.meta.url), 'utf8'),
  readFileSync(new URL('../app/request-actions.ts', import.meta.url), 'utf8'),
  readFileSync(new URL('../app/order/actions.ts', import.meta.url), 'utf8'),
];

test('anonymous mutations verify the optional form captcha before Supabase writes', () => {
  for (const source of actionSources) {
    assert.match(source, /verifyFormCaptcha\(input\)/);
    assert.match(source, /BOT_CHECK_FAILED/);
    assert.match(source, /verifyFormCaptcha[\s\S]*createServerSupabaseClient/);
    assert.doesNotMatch(source, /p_\w*turnstile/i);
  }
});
