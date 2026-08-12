import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const route = readFileSync(new URL('../app/api/webhooks/sepay/route.ts', import.meta.url), 'utf8');
const liveRoute = readFileSync(new URL('../app/hooks/payment/route.ts', import.meta.url), 'utf8');
const proxy = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8');

test('webhook route verifies the raw body before parsing or writing', () => {
  const rawBodyIndex = route.indexOf('await request.text()');
  const verifyIndex = route.indexOf('if (!verifySepayHmac');
  const parseIndex = route.indexOf('JSON.parse(rawBody)');
  const rpcIndex = route.indexOf("admin.rpc('process_sepay_webhook'");

  assert.ok(rawBodyIndex > 0);
  assert.ok(verifyIndex > rawBodyIndex);
  assert.ok(parseIndex > verifyIndex);
  assert.ok(rpcIndex > parseIndex);
});

test('webhook route is feature-gated and bounds JSON request size', () => {
  assert.match(route, /NEXT_PUBLIC_ENABLE_SEPAY !== 'true'/);
  assert.match(route, /MAX_BODY_BYTES = 64 \* 1024/);
  assert.match(route, /content-type[\s\S]*application\/json/i);
  assert.match(route, /resolveSepayPaymentCode/);
  assert.match(route, /p_code: rpcCode/);
  assert.match(route, /\{ success: true \}/);
  assert.match(route, /\[CORRELATION_HEADER\]: correlationId/);
  assert.doesNotMatch(route, /paid=true|addPoints|updateOrderStatus/);
  assert.match(liveRoute, /export \{ POST \} from ['"]@\/app\/api\/webhooks\/sepay\/route['"]/);
  assert.match(proxy, /\(\?!api\/webhooks\|hooks\/payment\|/);
});
