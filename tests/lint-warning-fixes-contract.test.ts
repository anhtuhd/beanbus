import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync('supabase/migrations/20260811041000_fix_remote_lint_warnings.sql', 'utf8');

test('remote lint warning fixes preserve signatures and consume previously unused inputs', () => {
  assert.match(migration, /create or replace function public\.update_loyalty_policy\(/i);
  assert.match(migration, /perform 1 from public\.loyalty_policy where id for update/i);
  assert.match(migration, /create or replace function public\.process_sepay_reconciliation\(/i);
  assert.match(migration, /p_content is null|char_length\(trim\(p_content\)\)/i);
  assert.match(migration, /create or replace function public\.process_sepay_webhook\(/i);
  assert.match(migration, /char_length\(trim\(p_gateway\)\)/i);
  assert.match(migration, /create or replace function public\.process_stored_value_webhook\(/i);
});
