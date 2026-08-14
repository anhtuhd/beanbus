import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync('supabase/migrations/20260814100000_secure_stored_value_codes_and_history.sql', 'utf8');
const historyQuery = readFileSync('lib/stored-value/history.ts', 'utf8');
const page = readFileSync('app/account/payment-history/page.tsx', 'utf8');

test('payment history is an authenticated, paginated RPC boundary', () => {
  assert.match(migration, /create or replace function public\.get_member_payment_history\(\s*p_page integer default 1,\s*p_page_size integer default 20/i);
  assert.match(migration, /where topups\.user_id = \(select auth\.uid\(\)\)/i);
  assert.match(migration, /where purchases\.user_id = \(select auth\.uid\(\)\)/i);
  assert.match(migration, /where orders\.user_id = \(select auth\.uid\(\)\)/i);
  assert.match(migration, /grant execute on function public\.get_member_payment_history\(integer, integer\) to authenticated/i);
  assert.match(historyQuery, /supabase\.rpc\('get_member_payment_history'/);
  assert.match(historyQuery, /p_page_size: PAGE_SIZE/);
});

test('member payment history renders transaction code and status', () => {
  assert.match(page, /Mã giao dịch/);
  assert.match(page, /payment_code/);
  assert.match(page, /statusLabel/);
  assert.match(page, /account\/topup/);
});
