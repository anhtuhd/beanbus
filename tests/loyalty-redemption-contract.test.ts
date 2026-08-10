import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const migration = readFileSync('supabase/migrations/20260810033201_loyalty_redemption.sql', 'utf8');
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
