import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260811133000_commerce_policy.sql', import.meta.url),
  'utf8',
);

test('commerce policy is admin-only, audited, and forward-only', () => {
  assert.match(migration, /create table public\.commerce_policy/i);
  assert.match(migration, /create table public\.commerce_policy_history/i);
  assert.match(migration, /create table public\.order_refund_history/i);
  assert.match(migration, /revoke all on table public\.commerce_policy, public\.commerce_policy_history, public\.order_refund_history from anon, authenticated/i);
  assert.match(migration, /create function public\.update_commerce_policy/i);
  assert.match(migration, /actor_user_id uuid not null references auth\.users/i);
});

test('voucher and loyalty lifecycle read configurable policy modes', () => {
  assert.match(migration, /voucher_on_cancel text not null default 'release'/i);
  assert.match(migration, /voucher_on_refund text not null default 'release'/i);
  assert.match(migration, /coalesce\(v_refund_mode, 'release'\) = 'release'/i);
  assert.match(migration, /coalesce\(v_cancel_mode, 'release'\) = 'release'/i);
  assert.match(migration, /loyalty_reverse_on_cancel boolean not null default true/i);
  assert.match(migration, /loyalty_reverse_on_refund boolean not null default true/i);
  assert.match(migration, /new\.status = 'cancelled' and coalesce\(v_reverse_on_cancel, true\)/i);
  assert.match(migration, /new\.payment_status = 'refunded' and coalesce\(v_reverse_on_refund, true\)/i);
});

test('refund RPC enforces policy, time window, and payment eligibility', () => {
  assert.match(migration, /create function public\.refund_order_payment\(p_order_id uuid\)/i);
  assert.match(migration, /if not found or not v_policy\.refund_enabled then raise exception 'REFUNDS_DISABLED'/i);
  assert.match(migration, /make_interval\(hours => v_policy\.refund_window_hours\)/i);
  assert.match(migration, /v_order\.payment_method <> 'sepay_qr' or v_order\.payment_status <> 'paid'/i);
  assert.match(migration, /update public\.payments[\s\S]*set status = 'refunded'/i);
  assert.match(migration, /on conflict \(order_id, payment_id\) do nothing/i);
  assert.match(migration, /grant execute on function public\.refund_order_payment\(uuid\) to authenticated/i);
});

test('admin UI exposes policy configuration and refund action', () => {
  const page = readFileSync(new URL('../app/admin/policies/page.tsx', import.meta.url), 'utf8');
  const form = readFileSync(new URL('../app/admin/policies/CommercePolicyForm.tsx', import.meta.url), 'utf8');
  const refundForm = readFileSync(new URL('../app/admin/orders/RefundOrderForm.tsx', import.meta.url), 'utf8');
  assert.match(page, /get_commerce_policy/);
  assert.match(form, /refundWindowHours/);
  assert.match(form, /voucherOnCancel/);
  assert.match(form, /loyaltyReverseOnRefund/);
  assert.match(refundForm, /refundAdminOrder/);
  assert.match(refundForm, /window\.confirm/);
});
