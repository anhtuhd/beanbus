import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const migrationPath = 'supabase/migrations/20260814090000_loyalty_points_payment.sql';
const migration = readFileSync(migrationPath, 'utf8');
const orderAction = readFileSync('app/order/actions.ts', 'utf8');
const checkout = readFileSync('app/order/checkout/CheckoutClient.tsx', 'utf8');
const cartDrawer = readFileSync('components/ui/CartDrawer.tsx', 'utf8');
const cartContext = readFileSync('context/CartContext.tsx', 'utf8');
const pointsRoute = readFileSync('app/api/account/points/route.ts', 'utf8');
const adminMember = readFileSync('app/admin/members/[id]/page.tsx', 'utf8');
const adminMembersList = readFileSync('app/admin/members/page.tsx', 'utf8');
const pointsAdjustmentAction = readFileSync('app/admin/members/[id]/actions.ts', 'utf8');
const pointsAdjustmentForm = readFileSync('app/admin/members/[id]/MemberPointsAdjustmentForm.tsx', 'utf8');

test('points payment schema preserves order money invariants', () => {
  assert.match(migration, /add column if not exists points_applied integer/);
  assert.match(migration, /add column if not exists cash_due_vnd integer/);
  assert.match(migration, /add column if not exists request_fingerprint text/);
  assert.match(migration, /where cash_due_vnd = 0 and total_vnd > 0/);
  assert.match(migration, /cash_due_vnd = total_vnd - points_applied/);
  assert.match(migration, /points_applied between 0 and total_vnd/);
});

test('points payment uses a gated, server-priced, idempotent RPC', () => {
  assert.match(migration, /create function public\.create_server_priced_order_v2\(/);
  assert.match(migration, /p_points_to_apply integer/);
  assert.match(migration, /points_payment_enabled/);
  assert.match(migration, /request_fingerprint/);
  assert.match(migration, /IDEMPOTENCY_CONFLICT/);
  assert.match(migration, /POINTS_PAYMENT_DISABLED/);
  assert.match(migration, /POINTS_AUTH_REQUIRED/);
  assert.match(migration, /order_payment_debit/);
  assert.match(migration, /pg_advisory_xact_lock\(public\.loyalty_wallet_lock_key/);
});

test('point restoration and reward earning are distinct ledger operations', () => {
  assert.match(migration, /order_payment_refund/);
  assert.match(migration, /order_reversal/);
  assert.match(migration, /cash_due_vnd::numeric/);
  assert.match(migration, /refund_order_settlement/);
});

test('checkout sends requested points and displays the cash remainder', () => {
  assert.match(orderAction, /create_server_priced_order_v2/);
  assert.match(orderAction, /p_points_to_apply/);
  assert.match(checkout, /pointsToApply/);
  assert.match(checkout, /Dùng điểm|Use points/);
  assert.match(checkout, /pointsSummary/);
  assert.match(checkout, /setUsePoints/);
  assert.match(checkout, /cashDueVnd/);
});

test('cart exposes the member balance and carries the points toggle to checkout', () => {
  assert.match(cartContext, /usePoints: boolean/);
  assert.match(cartContext, /setUsePoints/);
  assert.match(cartContext, /setUsePoints\(false\)/);
  assert.match(cartDrawer, /\/api\/account\/points/);
  assert.match(cartDrawer, /role="switch"/);
  assert.match(cartDrawer, /Điểm khả dụng|Available points/);
  assert.match(cartDrawer, /BẬT|ON/);
  assert.match(cartDrawer, /TẮT|OFF/);
  assert.match(checkout, /usePoints/);
});

test('cart promo inputs do not reveal example voucher codes in placeholders', () => {
  assert.doesNotMatch(cartDrawer, /placeholder=/);
  assert.doesNotMatch(readFileSync('app/order/cart/CartClient.tsx', 'utf8'), /placeholder=/);
});

test('points balance endpoint is member-only and never cached', () => {
  assert.match(pointsRoute, /get_member_loyalty_summary_v2/);
  assert.match(pointsRoute, /profile\.role !== 'member'/);
  assert.match(pointsRoute, /no-store/);
  assert.match(pointsRoute, /availablePoints/);
});

test('SePay creation reads back an uncertain payment before compensation', () => {
  assert.match(orderAction, /from\('payments'\)/);
  assert.match(orderAction, /maybeSingle\(\)/);
  assert.match(orderAction, /compensate_order_payment_failure/);
});

test('member administration exposes a guarded points adjustment flow', () => {
  assert.match(migration, /create function public\.admin_adjust_member_points\(/);
  assert.match(migration, /p_delta integer/);
  assert.match(migration, /p_reason text/);
  assert.match(migration, /not between 10 and 300/);
  assert.match(migration, /delta.*10000000|10000000.*delta/);
  assert.match(adminMember, /admin_adjust_member_points|MemberPointsAdjustmentForm/);
  assert.match(adminMember, /member-points-adjustment-title/);
});

test('member directory routes member edits to one detail page', () => {
  assert.match(adminMembersList, /Chỉnh sửa/);
  assert.match(adminMembersList, /editMemberLink/);
  assert.doesNotMatch(adminMembersList, /MemberRoleForm/);
  assert.match(adminMembersList, /balances\.get\(member\.id\)/);
});

test('manual points adjustment keeps a stable retry key and previews the result', () => {
  assert.match(pointsAdjustmentAction, /formData\.get\('idempotencyKey'\)/);
  assert.match(pointsAdjustmentAction, /p_idempotency_key: idempotencyKey/);
  assert.doesNotMatch(pointsAdjustmentAction, /p_idempotency_key: crypto\.randomUUID\(\)/);
  assert.match(pointsAdjustmentAction, /IDEMPOTENCY_CONFLICT/);
  assert.match(pointsAdjustmentForm, /name="idempotencyKey"/);
  assert.match(pointsAdjustmentForm, /crypto\.randomUUID\(\)/);
  assert.match(pointsAdjustmentForm, /aria-pressed/);
  assert.match(pointsAdjustmentForm, /Số dư sau điều chỉnh/);
  assert.match(pointsAdjustmentForm, /Không đủ điểm để trừ/);
});
