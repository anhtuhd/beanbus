import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260811032754_voucher_lifecycle.sql', import.meta.url),
  'utf8'
);

test('voucher lifecycle stores a service-only reservation ledger', () => {
  assert.match(migration, /create table public\.voucher_reservations/i);
  assert.match(migration, /status text not null default 'reserved'[\s\S]*status in \('reserved', 'consumed', 'released'\)/i);
  assert.match(migration, /alter table public\.voucher_reservations enable row level security/i);
  assert.match(migration, /revoke all on table public\.voucher_reservations from anon, authenticated/i);
});

test('voucher reservations release exactly once on cancellation or failed payment', () => {
  assert.match(migration, /new\.status = 'cancelled' or new\.payment_status in \('failed', 'refunded'\)/i);
  assert.match(migration, /status = 'released', released_at = coalesce\(released_at, now\(\)\)/i);
  assert.match(migration, /usage_count = greatest\(usage_count - 1, 0\)/i);
  assert.match(migration, /where code = v_reservation\.voucher_code/i);
});

test('voucher reservations consume on paid SePay or completed COD', () => {
  assert.match(migration, /new\.payment_status = 'paid'/i);
  assert.match(migration, /new\.payment_method = 'cod' and new\.status = 'completed'/i);
  assert.match(migration, /status = 'consumed', consumed_at = coalesce\(consumed_at, now\(\)/i);
  assert.match(readFileSync(new URL('../supabase/tests/database/voucher_lifecycle.test.sql', import.meta.url), 'utf8'), /usage limit rejects a second reservation/i);
});

test('expired provider payments propagate a failed payment state to the order', () => {
  assert.match(migration, /create trigger payments_sync_order_payment_status/i);
  assert.match(migration, /new\.status in \('expired', 'failed'\)/i);
  assert.match(migration, /set payment_status = 'failed'/i);
  assert.match(migration, /create function public\.expire_pending_sepay_payments/i);
  assert.match(migration, /created_at <= now\(\) - interval '30 minutes'/i);
  assert.match(migration, /not exists \([\s\S]*public\.payments[\s\S]*payments\.order_id = orders\.id/i);
});
