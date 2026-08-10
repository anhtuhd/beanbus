import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const migration = readFileSync('supabase/migrations/20260810032413_loyalty_ledger.sql', 'utf8');
const action = readFileSync('app/admin/loyalty/actions.ts', 'utf8');
const page = readFileSync('app/admin/loyalty/page.tsx', 'utf8');

test('loyalty policy is admin-controlled, audited, and defaults disabled', () => {
  assert.match(migration, /insert into public\.loyalty_policy[\s\S]*false, 0, false/i);
  assert.match(migration, /create function public\.update_loyalty_policy/i);
  assert.match(migration, /insert into public\.loyalty_policy_history/i);
  assert.match(migration, /create function public\.get_loyalty_policy/i);
  assert.match(migration, /current_user_role\(\)\) is distinct from 'admin'/i);
});

test('admin loyalty UI uses the protected policy RPC', () => {
  assert.match(action, /requireAdmin\(\)/);
  assert.match(action, /supabase\.rpc\('update_loyalty_policy'/);
  assert.match(page, /requireAdmin\(\)/);
  assert.match(page, /get_loyalty_policy/);
});
