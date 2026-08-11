import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync('supabase/migrations/20260811035916_fix_remote_lint_errors.sql', 'utf8');

test('remote lint fixes preserve signatures and use valid aggregate/crypto calls', () => {
  assert.match(migration, /create or replace function public\.get_member_loyalty_summary\(p_user_id uuid\)/i);
  assert.match(migration, /coalesce\(\(\s*select sum\(ledger\.points\)/i);
  assert.match(migration, /create or replace function public\.admin_upsert_event\(/i);
  assert.match(migration, /create or replace function public\.admin_upsert_blog_post\(/i);
  assert.equal((migration.match(/extensions\.gen_random_bytes\(8\)/g) ?? []).length, 2);
});
