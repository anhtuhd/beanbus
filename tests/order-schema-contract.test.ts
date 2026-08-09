import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260809140913_server_priced_orders.sql', import.meta.url),
  'utf8'
);

test('order creation is a locked security-definer transaction with idempotency', () => {
  assert.match(migration, /create function public\.create_server_priced_order[\s\S]*security definer[\s\S]*set search_path = ''/i);
  assert.match(migration, /idempotency_key uuid not null unique/i);
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(p_idempotency_key::text, 0\)\)/i);
  assert.match(migration, /grant execute on function public\.create_server_priced_order[\s\S]*to anon, authenticated/i);
});

test('order pricing comes from published catalog records and validated options', () => {
  assert.match(migration, /from public\.products[\s\S]*is_published and is_available/i);
  assert.match(migration, /sum\(extra_price_vnd\)[\s\S]*option_set_id = v_product\.option_set_id/i);
  assert.match(migration, /v_line_total := \(v_product\.price_vnd \+ v_options_price\) \* v_quantity/i);
  assert.doesNotMatch(migration, /v_item\s*->>\s*'(unitPrice|price|total)'/i);
});

test('order tables are private and members read only owned orders', () => {
  for (const table of ['vouchers', 'orders', 'order_items', 'order_item_options']) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  }
  assert.match(migration, /Members read their orders[\s\S]*auth\.uid\(\)\) = user_id/i);
  assert.doesNotMatch(migration, /grant (insert|update|delete)[^;]*to anon/i);
});

test('voucher use is bounded and updated under a row lock', () => {
  assert.match(migration, /where code = v_code for update/i);
  assert.match(migration, /v_discount := least\(v_subtotal, v_discount, coalesce\(v_voucher\.maximum_discount_vnd, v_discount\)\)/i);
  assert.match(migration, /usage_count = usage_count \+ 1/i);
});
