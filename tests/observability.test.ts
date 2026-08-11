import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CORRELATION_HEADER,
  createCorrelationId,
  logOperationalEvent,
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

test('payment integration events emit bounded counters without sensitive fields', () => {
  const lines: string[] = [];
  logOperationalEvent({
    correlationId: 'req_01K2A7C8Q9',
    event: 'payment_reconciliation_completed',
    operation: 'reconcile_sepay_transactions',
    metrics: {
      pages: 2,
      processed: 1,
      rejected: 3,
      duplicates: 2,
      skipped: 4,
    },
  }, (line) => lines.push(line), new Date('2026-08-09T12:00:00.000Z'));

  assert.deepEqual(JSON.parse(lines[0]), {
    timestamp: '2026-08-09T12:00:00.000Z',
    level: 'info',
    service: 'beanbus-web',
    event: 'payment_reconciliation_completed',
    correlationId: 'req_01K2A7C8Q9',
    operation: 'reconcile_sepay_transactions',
    pages: 2,
    processed: 1,
    rejected: 3,
    duplicates: 2,
    skipped: 4,
  });
  assert.doesNotMatch(lines[0], /payment_code|account_number|payload|token|secret/i);
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
  assert.match(webhook, /logOperationalEvent/);
  assert.match(webhook, /outcome !== 'processed'/);
  assert.match(webhook, /logOperationalFailure/);
  assert.match(webhook, /headers: \{ \[CORRELATION_HEADER\]: correlationId \}/);
  assert.doesNotMatch(webhook, /logOperationalFailure\(\{[^}]*rawPayload/);

  const reconciliation = readFileSync(new URL('../app/api/cron/sepay-reconciliation/route.ts', import.meta.url), 'utf8');
  assert.match(reconciliation, /payment_reconciliation_completed/);
  assert.match(reconciliation, /payment_reconciliation_gap/);
  const eventCalls = reconciliation.match(/logOperationalEvent\(\{[\s\S]*?\}\);/g) ?? [];
  assert.equal(eventCalls.length, 2);
  for (const eventCall of eventCalls) {
    assert.doesNotMatch(eventCall, /apiKey|payload|accountNumber|payment_code|secret/i);
  }
});

test('health endpoint is uncached, correlated, and fails closed on production configuration', () => {
  const health = readFileSync(new URL('../app/api/health/route.ts', import.meta.url), 'utf8');

  assert.match(health, /assertProductionEnv\(\)/);
  assert.match(health, /'Cache-Control': 'no-store'/);
  assert.match(health, /\[CORRELATION_HEADER\]: correlationId/);
  assert.match(health, /status: 'unavailable'/);
  assert.doesNotMatch(health, /SUPABASE_SECRET_KEY|SEPAY_WEBHOOK_SECRET|SEPAY_BANK_ACCOUNT/);
});
