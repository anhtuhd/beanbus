import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const migration = readFileSync('supabase/migrations/20260810025416_member_account_access.sql', 'utf8');
const query = readFileSync('lib/account/queries.ts', 'utf8');
const page = readFileSync('app/account/page.tsx', 'utf8');

test('member account exposes only active vouchers through an authenticated read policy', () => {
  assert.match(migration, /create policy "Members read active vouchers"[\s\S]*for select[\s\S]*to authenticated/i);
  assert.match(migration, /is_active[\s\S]*starts_at[\s\S]*ends_at/i);
});

test('member account queries use RLS-owned orders and pass server data to the UI', () => {
  assert.match(query, /from\('orders'\)[\s\S]*\.from\('order_items'\)/i);
  assert.doesNotMatch(query, /\.eq\('user_id'/i);
  assert.match(page, /getMemberAccountData\(\)/);
  assert.match(page, /initialOrders=\{accountData\.orders\}/);
  assert.match(page, /availableVouchers=\{accountData\.vouchers\}/);
});
