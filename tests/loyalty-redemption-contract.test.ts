import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const migration = readFileSync('supabase/migrations/20260810033201_loyalty_redemption.sql', 'utf8');
const fixMigration = readFileSync('supabase/migrations/20260811025637_fix_loyalty_reversal_idempotency.sql', 'utf8');
const collisionMigration = readFileSync('supabase/migrations/20260811120000_fix_loyalty_redemption_collision.sql', 'utf8');
const action = readFileSync('app/account/redeem-actions.ts', 'utf8');
const page = readFileSync('app/account/AccountClient.tsx', 'utf8');
const form = readFileSync('app/account/RewardRedeemForm.tsx', 'utf8');
const adminPage = readFileSync('app/admin/rewards/page.tsx', 'utf8');

test('redemption creates an owned voucher and debits the ledger idempotently', () => {
  assert.match(migration, /assigned_user_id uuid references auth\.users/i);
  assert.match(migration, /create table public\.loyalty_rewards/i);
  assert.match(migration, /create function public\.redeem_loyalty_reward/i);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /source_key = 'redemption:'/);
  assert.match(migration, /assigned_user_id\)/);
  assert.match(migration, /create function public\.validate_order_voucher_owner/i);
});

test('redemption idempotency keys are scoped to the authenticated member', () => {
  assert.match(fixMigration, /source_key = 'redemption:' \|\| p_idempotency_key::text\s+and user_id = v_user_id/);
  assert.match(fixMigration, /IDEMPOTENCY_CONFLICT/);
  assert.match(collisionMigration, /hashtextextended\('loyalty-redemption:' \|\| p_idempotency_key::text, 0\)/);
  assert.match(collisionMigration, /where source_key = v_source_key\s+for update/);
  assert.match(collisionMigration, /v_existing\.user_id is distinct from v_user_id/);
});

test('member redemption action and UI use the protected RPC', () => {
  assert.match(action, /requireProfile/);
  assert.match(action, /supabase\.rpc\('redeem_loyalty_reward'/);
  assert.match(page, /RewardRedeemForm/);
  assert.match(form, /redeemMemberReward/);
  assert.match(form, /idempotencyKey/);
});

test('admin reward catalog is bounded, searchable, and paginated', () => {
  assert.match(adminPage, /searchParams/);
  assert.match(adminPage, /count: 'exact'/);
  assert.match(adminPage, /\.or\(/);
  assert.match(adminPage, /\.range\(/);
  assert.match(adminPage, /Phân trang reward/);
});
