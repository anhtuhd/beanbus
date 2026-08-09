import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260809141811_order_receipts.sql', import.meta.url),
  'utf8'
);

test('guest receipts require a high-entropy token in addition to the order id', () => {
  assert.match(migration, /receipt_token uuid not null default gen_random_uuid\(\) unique/i);
  assert.match(migration, /where orders\.id = p_order_id[\s\S]*orders\.receipt_token = p_receipt_token/i);
  assert.doesNotMatch(migration, /p_(paid|status|total)/i);
});

test('receipt access is exposed only through locked security-definer functions', () => {
  assert.match(migration, /create function public\.get_order_receipt[\s\S]*security definer[\s\S]*set search_path = ''/i);
  assert.match(migration, /revoke all on function public\.get_order_receipt\(uuid, uuid\) from public/i);
  assert.match(migration, /grant execute on function public\.get_order_receipt\(uuid, uuid\) to anon, authenticated/i);
});

test('issued receipts are scoped to the caller that created the idempotent order', () => {
  assert.match(migration, /orders\.user_id is not distinct from \(select auth\.uid\(\)\)/i);
});
