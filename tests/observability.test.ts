import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CORRELATION_HEADER,
  createCorrelationId,
  logOperationalFailure,
} from '../lib/observability/logger.ts';
import { withSupportReference } from '../lib/observability/support-reference.ts';

test('correlation IDs preserve safe upstream values and replace unsafe input', () => {
  assert.equal(CORRELATION_HEADER, 'x-request-id');
  assert.equal(createCorrelationId('req_01K2A7C8Q9'), 'req_01K2A7C8Q9');
  assert.match(createCorrelationId('phone=0937936688'), /^[0-9a-f-]{36}$/);
  assert.match(createCorrelationId(null), /^[0-9a-f-]{36}$/);
});

test('support references are appended only for operational failures', () => {
  assert.equal(withSupportReference('Không thể gửi.', undefined, 'Mã hỗ trợ'), 'Không thể gửi.');
  assert.equal(
    withSupportReference('Không thể gửi.', 'req_01K2A7C8Q9', 'Mã hỗ trợ'),
    'Không thể gửi. Mã hỗ trợ: req_01K2A7C8Q9'
  );
});

test('operational failures emit one bounded JSON record without arbitrary detail fields', () => {
  const lines: string[] = [];
  const correlationId = logOperationalFailure({
    correlationId: 'req_01K2A7C8Q9',
    event: 'order_failed',
    operation: 'create_order',
    reason: 'database_error',
  }, (line) => lines.push(line), new Date('2026-08-09T12:00:00.000Z'));

  assert.equal(correlationId, 'req_01K2A7C8Q9');
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), {
    timestamp: '2026-08-09T12:00:00.000Z',
    level: 'error',
    service: 'beanbus-web',
    event: 'order_failed',
    correlationId: 'req_01K2A7C8Q9',
    operation: 'create_order',
    reason: 'database_error',
  });
});

test('proxy propagates one correlation ID upstream and back to the caller', () => {
  const proxy = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8');
  const sessionProxy = readFileSync(new URL('../lib/supabase/proxy.ts', import.meta.url), 'utf8');

  assert.match(proxy, /requestHeaders\.set\(CORRELATION_HEADER, correlationId\)/);
  assert.match(proxy, /response\.headers\.set\(CORRELATION_HEADER, correlationId\)/);
  assert.match(sessionProxy, /request: \{ headers: requestHeaders \}/);
});

test('critical server boundaries emit correlated failures without raw payload logging', () => {
  const sources = [
    '../app/order/actions.ts',
    '../app/booking/actions.ts',
    '../app/request-actions.ts',
    '../app/admin/orders/actions.ts',
    '../app/admin/requests/actions.ts',
    '../app/admin/catalog/actions.ts',
    '../app/admin/content/actions.ts',
  ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'));
  const webhook = readFileSync(new URL('../app/api/webhooks/sepay/route.ts', import.meta.url), 'utf8');

  for (const source of sources) {
    assert.match(source, /getRequestCorrelationId/);
    assert.match(source, /logOperationalFailure/);
  }
  assert.match(webhook, /createCorrelationId\(request\.headers\.get\(CORRELATION_HEADER\)\)/);
  assert.match(webhook, /logOperationalFailure/);
  assert.match(webhook, /headers: \{ \[CORRELATION_HEADER\]: correlationId \}/);
  assert.doesNotMatch(webhook, /logOperationalFailure\(\{[^}]*rawPayload/);
});

test('health endpoint is uncached, correlated, and fails closed on production configuration', () => {
  const health = readFileSync(new URL('../app/api/health/route.ts', import.meta.url), 'utf8');

  assert.match(health, /assertProductionEnv\(\)/);
  assert.match(health, /'Cache-Control': 'no-store'/);
  assert.match(health, /\[CORRELATION_HEADER\]: correlationId/);
  assert.match(health, /status: 'unavailable'/);
  assert.doesNotMatch(health, /SUPABASE_SECRET_KEY|SEPAY_WEBHOOK_SECRET|SEPAY_BANK_ACCOUNT/);
});
