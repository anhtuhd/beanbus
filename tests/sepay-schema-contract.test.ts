import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260809143500_sepay_payments.sql', import.meta.url),
  'utf8'
);

test('Sepay ledger deduplicates provider events and protects raw payloads', () => {
  assert.match(migration, /provider_transaction_id bigint primary key/i);
  assert.match(migration, /alter table public\.sepay_webhook_events enable row level security/i);
  assert.match(migration, /revoke all on table public\.payments, public\.sepay_webhook_events from anon, authenticated/i);
});

test('payment creation and webhook processing are service-only locked functions', () => {
  assert.match(migration, /create function public\.create_sepay_payment[\s\S]*security definer[\s\S]*set search_path = ''/i);
  assert.match(migration, /create function public\.process_sepay_webhook[\s\S]*security definer[\s\S]*set search_path = ''/i);
  assert.match(migration, /grant execute on function public\.create_sepay_payment[\s\S]*to service_role/i);
  assert.match(migration, /grant execute on function public\.process_sepay_webhook[\s\S]*to service_role/i);
});

test('verified payment transition matches code, amount, account, direction, and expiry', () => {
  assert.match(migration, /payment_code = upper\(p_code\)/i);
  assert.match(migration, /p_transfer_amount <> v_payment\.amount_vnd/i);
  assert.match(migration, /p_account_number <> v_payment\.account_number/i);
  assert.match(migration, /p_transfer_type <> 'in'/i);
  assert.match(migration, /p_transaction_at > v_payment\.expires_at/i);
  assert.match(migration, /update public\.orders[\s\S]*payment_status = 'paid'/i);
});
