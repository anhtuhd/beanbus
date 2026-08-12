import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260812012522_sepay_order_code_and_expiry.sql', import.meta.url),
  'utf8'
);
const receipt = readFileSync(new URL('../supabase/migrations/20260812012522_sepay_order_code_and_expiry.sql', import.meta.url), 'utf8');
const confirmation = readFileSync(new URL('../app/order/confirmation/[id]/ProductionConfirmation.tsx', import.meta.url), 'utf8');

test('orders and Sepay payments use the public DH order code format', () => {
  assert.match(migration, /add column order_code text/i);
  assert.match(migration, /DH-\[0-9\]\{6\}\[A-Za-z0-9\]\{6\}/i);
  assert.match(migration, /v_order\.order_code/i);
  assert.match(migration, /interval '15 minutes'/i);
  assert.match(receipt, /'orderCode', orders\.order_code/i);
});

test('Sepay expiry cancels the pending order and schedules database cleanup', () => {
  assert.match(migration, /status = 'cancelled'/i);
  assert.match(migration, /payment_status = 'failed'/i);
  assert.match(migration, /return v_expired \+ v_abandoned/i);
  assert.match(migration, /cron\.schedule[\s\S]*\* \* \* \* \*/i);
});

test('customer payment screen exposes a live 15-minute countdown', () => {
  assert.match(confirmation, /expiresAt/);
  assert.match(confirmation, /setInterval\([^,]+, 1000\)/);
  assert.match(confirmation, /Đếm ngược|countdown/i);
  assert.match(confirmation, /order\.orderCode/);
  assert.match(confirmation, /visibilitychange/);
  assert.match(confirmation, /Math\.min\(30_000/);
});
