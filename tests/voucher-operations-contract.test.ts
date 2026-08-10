import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const migration = readFileSync('supabase/migrations/20260810032847_voucher_operations.sql', 'utf8');
const action = readFileSync('app/admin/vouchers/actions.ts', 'utf8');
const page = readFileSync('app/admin/vouchers/page.tsx', 'utf8');

test('voucher writes are revoked from browser tables and audited through an admin RPC', () => {
  assert.match(migration, /create table public\.voucher_change_history/i);
  assert.match(migration, /revoke insert, update, delete on table public\.vouchers from authenticated/i);
  assert.match(migration, /create function public\.admin_upsert_voucher/i);
  assert.match(migration, /insert into public\.voucher_change_history/i);
  assert.match(migration, /grant execute on function public\.admin_upsert_voucher[\s\S]*to authenticated/i);
});

test('voucher admin action validates discount bounds and uses the RPC boundary', () => {
  assert.match(action, /requireAdmin\(\)/);
  assert.match(action, /discountValue <= 0/);
  assert.match(action, /supabase\.rpc\('admin_upsert_voucher'/);
  assert.doesNotMatch(action, /\.from\('vouchers'\)\.(insert|update|delete)/i);
  assert.match(page, /VoucherEditorForm/);
});

test('voucher admin list is bounded, searchable, and paginated', () => {
  assert.match(page, /searchParams/);
  assert.match(page, /count: 'exact'/);
  assert.match(page, /ilike\('code'/);
  assert.match(page, /\.range\(/);
  assert.match(page, /Phân trang voucher/);
});
