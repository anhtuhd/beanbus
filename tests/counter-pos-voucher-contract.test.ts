import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync('supabase/migrations/20260815084507_counter_members_pos_voucher_wallet.sql', 'utf8');
const hardeningMigration = readFileSync('supabase/migrations/20260815120000_harden_counter_members_and_voucher_claims.sql', 'utf8');
const session = readFileSync('lib/auth/session.ts', 'utf8');
const env = readFileSync('.env.example', 'utf8');
const memberPassRoute = readFileSync('app/api/pos/member-pass/resolve/route.ts', 'utf8');
const memberPassButton = readFileSync('app/account/MemberPassButton.tsx', 'utf8');
const voucherActions = readFileSync('app/admin/vouchers/actions.ts', 'utf8');
const counterOrderActions = readFileSync('app/pos/orders/actions.ts', 'utf8');
const posOrderPage = readFileSync('app/pos/orders/[id]/page.tsx', 'utf8');

test('counter member migration keeps phone identity unique and separates pending activation', () => {
  assert.match(migration, /pending_phone text/i);
  assert.match(migration, /membership_status/i);
  assert.match(migration, /unique index[\s\S]*coalesce\(phone, pending_phone\)/i);
  assert.match(migration, /operator_register_pending_member/i);
  assert.match(migration, /operator_search_members/i);
  assert.match(migration, /PENDING_MEMBER_REQUIRED/);
  assert.match(migration, /phone_confirmed_at is null/);
  assert.match(hardeningMigration, /case when new\.phone_confirmed_at is null then new\.phone else null end/i);
  assert.doesNotMatch(hardeningMigration, /raw_user_meta_data ->> 'pending_phone'/i);
  assert.match(migration, /phone ~ '\^\\\+84\[35789\]\[0-9\]\{8\}\$'/);
  assert.match(migration, /guard_blocked_member_order/);
});

test('staff POS transitions are database-authorized and cannot cancel orders', () => {
  assert.match(migration, /operator_advance_order/i);
  assert.match(migration, /role.*staff|staff.*role/i);
  assert.match(migration, /cancelled.*not allowed|CANCEL_NOT_ALLOWED|INVALID_OPERATOR_TRANSITION/i);
  assert.match(session, /requireOperator/);
  assert.doesNotMatch(counterOrderActions, /\.from\('orders'\)\.select\('status'\)/);
  assert.match(migration, /create function public\.operator_advance_order\(\s*p_order_id uuid\s*\)/i);
  assert.match(posOrderPage, /\.eq\('created_via', 'pos'\)/);
});

test('voucher wallet claims are idempotent and do not reserve campaign quota', () => {
  assert.match(migration, /create table (if not exists )?public\.voucher_wallet_entries/i);
  assert.match(migration, /unique \(user_id, voucher_code\)/i);
  assert.match(migration, /create function public\.claim_voucher/i);
  assert.match(migration, /create function public\.operator_claim_member_voucher/i);
  assert.match(migration, /usage_count/);
  assert.match(migration, /on conflict on constraint voucher_wallet_entries_user_voucher_key do nothing/i);
  assert.match(hardeningMigration, /returning true into v_claimed/i);
  assert.match(migration, /consent_confirmed boolean not null default false/i);
  assert.match(migration, /VOUCHER_CONSENT_REQUIRED/);
  assert.match(migration, /if v_entry\.used_order_id is not null then raise exception 'VOUCHER_ALREADY_USED'/i);
  assert.match(readFileSync('app/admin/orders/new/AdminOrderCreator.tsx', 'utf8'), /voucherConsentConfirmed/);
  assert.match(voucherActions, /admin_distribute_voucher/);
  assert.match(migration, /p_voucher_consent_confirmed boolean/i);
  assert.match(migration, /p_voucher_consent_note text/i);
  assert.match(migration, /VOUCHER_CONSENT_REQUIRED/);
  assert.match(migration, /voucher_consent_confirmed/i);
});

test('member pass uses a short-lived nonce instead of exposing member identifiers', () => {
  assert.match(migration, /member_pass_nonces/i);
  assert.match(env, /MEMBER_PASS_SECRET/);
  assert.match(memberPassRoute, /p_nonce_hash: pass\.nonceHash/);
  assert.match(migration, /consume_member_pass_nonce[\s\S]*current_user_role\(\)[\s\S]*OPERATOR_REQUIRED/i);
  assert.match(migration, /MEMBER_BLOCKED/);
  assert.match(migration, /p_nonce_hash !~ '\^\[0-9a-f\]\{64\}\$'/i);
  assert.match(migration, /delete from private\.member_pass_nonces/i);
  assert.doesNotMatch(memberPassRoute, /token\.split\('\.'\)\[2\]/);
  assert.doesNotMatch(memberPassRoute, /select\('[^']*email/);
  assert.match(memberPassRoute, /member:\s*\{\s*id: member\.id/);
  assert.match(memberPassButton, /Date\.parse\(expiresAt\) > Date\.now\(\)/);
});

test('POS search is exact and does not expose a wildcard member directory', () => {
  assert.match(migration, /p\.phone = v_phone/i);
  assert.match(migration, /p\.pending_phone = v_phone/i);
  assert.doesNotMatch(migration, /operator_search_members[\s\S]*like '%'/i);
});

test('POS and voucher wallet are disabled by default', () => {
  assert.match(env, /ENABLE_POS_STAFF=false/);
  assert.match(env, /NEXT_PUBLIC_ENABLE_VOUCHER_WALLET=false/);
});
