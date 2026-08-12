import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const migration = readFileSync('supabase/migrations/20260811031803_sepay_reconciliation.sql', 'utf8');
const route = readFileSync('app/api/cron/sepay-reconciliation/route.ts', 'utf8');
const env = readFileSync('lib/env.ts', 'utf8');

test('SePay reconciliation has a service-only text-key ledger and lease checkpoint', () => {
  assert.match(migration, /provider_transaction_key text/i);
  assert.match(migration, /create table public\.sepay_reconciliation_events/i);
  assert.match(migration, /create table public\.sepay_reconciliation_state/i);
  assert.match(migration, /create function public\.process_sepay_reconciliation/i);
  assert.match(migration, /create function public\.acquire_sepay_reconciliation_lease/i);
  assert.match(migration, /create function public\.complete_sepay_reconciliation/i);
  assert.match(migration, /grant execute on function public\.process_sepay_reconciliation[\s\S]*service_role/i);
  assert.match(migration, /grant execute on function public\.acquire_sepay_reconciliation_lease[\s\S]*service_role/i);
  assert.match(migration, /grant execute on function public\.complete_sepay_reconciliation[\s\S]*service_role/i);
});

test('reconciliation route is cron-authenticated, bounded, feature-gated, and secret-safe', () => {
  assert.match(route, /NEXT_PUBLIC_ENABLE_SEPAY_RECONCILIATION/);
  assert.match(route, /Authorization/);
  assert.match(route, /https:\/\/userapi\.sepay\.vn\/v2\/transactions/);
  assert.match(route, /formatSepayApiDate/);
  assert.match(route, /transaction_date_from/);
  assert.match(route, /transaction_date_to/);
  assert.match(route, /per_page.*PAGE_SIZE|PAGE_SIZE.*per_page/);
  assert.match(route, /MAX_PAGES/);
  assert.match(route, /process_sepay_reconciliation/);
  assert.match(route, /complete_sepay_reconciliation/);
  assert.doesNotMatch(route, /apiKey.*responseBody|cronSecret.*responseBody/);
  assert.match(route, /parseSepayV2Response/);
  assert.match(env, /NEXT_PUBLIC_ENABLE_SEPAY_RECONCILIATION/);
});
