import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const migration = readFileSync('supabase/migrations/20260815075735_admin_assisted_orders.sql', 'utf8');
const page = readFileSync('app/admin/orders/new/page.tsx', 'utf8');
const action = readFileSync('app/admin/orders/new/actions.ts', 'utf8');
const creator = readFileSync('app/admin/orders/new/AdminOrderCreator.tsx', 'utf8');
const orderList = readFileSync('app/admin/orders/page.tsx', 'utf8');
const memberDetail = readFileSync('app/admin/members/[id]/page.tsx', 'utf8');
const orderDetail = readFileSync('app/admin/orders/[id]/page.tsx', 'utf8');
const receiptButton = readFileSync('app/admin/orders/[id]/CopyGuestReceiptLinkButton.tsx', 'utf8');

test('admin order migration records source, actor, and immutable audit consent', () => {
  assert.match(migration, /created_via text not null default 'customer_web'/);
  assert.match(migration, /created_by_user_id uuid references auth\.users/);
  assert.match(migration, /admin_order_creation_audit/);
  assert.match(migration, /points_consent_confirmed boolean not null/);
  assert.match(migration, /points_consent_note text/);
  assert.match(migration, /revoke all on table public\.admin_order_creation_audit/);
  assert.match(migration, /TARGET_MEMBER_REQUIRED/);
  assert.match(migration, /POINTS_CONSENT_REQUIRED/);
});

test('admin RPC keeps pricing server-authoritative and separates QR confirmation', () => {
  assert.match(migration, /create function public\.admin_create_server_priced_order\(/);
  assert.match(migration, /create_server_priced_order_v2/);
  assert.match(migration, /public\.product_is_orderable/);
  assert.match(migration, /p_payment_method = 'cod' or v_order\.total_vnd - v_points = 0/);
  assert.match(migration, /v_creation_mode in \('admin_panel', 'pos'\)/);
  assert.match(migration, /IDEMPOTENCY_CONFLICT/);
  assert.match(migration, /for update/);
});

test('admin-created orders exclude only the initiating admin from new-order notifications', () => {
  assert.match(migration, /create or replace function public\.notify_new_order\(\)/);
  assert.match(migration, /enqueue_role_notifications/);
  assert.match(migration, /delete from public\.notifications/);
  assert.match(migration, /recipient_user_id = new\.created_by_user_id/);
  assert.match(migration, /source_type = 'order'/);
});

test('admin order UI is gated, links from operations, and supports member or guest', () => {
  assert.match(page, /requireAdmin\(\)/);
  assert.match(page, /ENABLE_ADMIN_ASSISTED_ORDERS/);
  assert.match(page, /products\.filter\(\(product\) => product\.isAvailable\)/);
  assert.match(action, /admin_create_server_priced_order/);
  assert.match(action, /getSiteUrl\(\)/);
  assert.match(action, /compensate_order_payment_failure/);
  assert.match(creator, /Hội viên/);
  assert.match(creator, /Khách vãng lai/);
  assert.match(creator, /pointsConsentConfirmed/);
  assert.match(creator, /sepay_qr/);
  assert.match(orderList, /\/admin\/orders\/new/);
  assert.match(memberDetail, /\/admin\/orders\/new\?memberId=/);
});

test('guest receipt link is copied only from an admin-created guest order', () => {
  assert.match(orderDetail, /created_via === 'admin_panel'/);
  assert.match(orderDetail, /user_id === null/);
  assert.match(orderDetail, /receipt_token/);
  assert.match(receiptButton, /navigator\.clipboard\.writeText/);
  assert.match(receiptButton, /url: string/);
});
