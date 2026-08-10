import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260809160500_order_status_operations.sql', import.meta.url),
  'utf8'
);
const memberHistoryMigration = readFileSync(
  new URL('../supabase/migrations/20260810050317_member_read_order_status_history.sql', import.meta.url),
  'utf8'
);

test('order status history audits both admin and system transitions', () => {
  assert.match(migration, /create table public\.order_status_history/i);
  assert.match(migration, /actor_type text not null[\s\S]*'admin'[\s\S]*'system'/i);
  assert.match(migration, /create trigger orders_audit_status_change[\s\S]*after update of status on public\.orders/i);
  assert.match(migration, /old\.status is distinct from new\.status/i);
});

test('authenticated clients lose direct order and payment status mutation', () => {
  assert.match(migration, /revoke update \(status, payment_status, updated_at\) on table public\.orders from authenticated/i);
  assert.match(migration, /grant execute on function public\.update_order_status[\s\S]*to authenticated/i);
});

test('order status RPC enforces transitions and payment boundaries', () => {
  assert.match(migration, /current_user_role\(\)\) is distinct from 'admin'/i);
  assert.match(migration, /pending:confirmed/);
  assert.match(migration, /confirmed:preparing/);
  assert.match(migration, /preparing:ready/);
  assert.match(migration, /ready:completed/);
  assert.match(migration, /payment_method = 'sepay_qr'[\s\S]*payment_status <> 'paid'[\s\S]*PAYMENT_REQUIRED/i);
  assert.match(migration, /payment_status = 'paid'[\s\S]*p_status = 'cancelled'[\s\S]*REFUND_REQUIRED/i);
  assert.match(migration, /INVALID_ORDER_TRANSITION/);
});

test('members can read only their own order status history', () => {
  assert.match(memberHistoryMigration, /Members read their order status history/i);
  assert.match(memberHistoryMigration, /orders\.user_id = \(select auth\.uid\(\)\)/i);
  assert.match(memberHistoryMigration, /current_user_role\(\)\) = 'admin'/i);
});
