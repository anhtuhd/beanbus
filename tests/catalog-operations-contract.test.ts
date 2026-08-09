import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260809162000_catalog_operations.sql', import.meta.url),
  'utf8'
);

test('catalog direct mutations are revoked from authenticated clients', () => {
  for (const table of ['catalog_categories', 'catalog_option_sets', 'catalog_options', 'products']) {
    assert.match(migration, new RegExp(`revoke insert, update, delete on table public\\.${table} from authenticated`, 'i'));
  }
});

test('product availability and publication changes are audited', () => {
  assert.match(migration, /create table public\.product_status_history/i);
  assert.match(migration, /from_is_available boolean not null/i);
  assert.match(migration, /to_is_published boolean not null/i);
  assert.match(migration, /actor_user_id uuid not null references auth\.users/i);
});

test('product status RPC is admin-only, locked, and idempotent', () => {
  assert.match(migration, /create function public\.update_product_status/i);
  assert.match(migration, /current_user_role\(\)\) is distinct from 'admin'/i);
  assert.match(migration, /from public\.products[\s\S]*for update/i);
  assert.match(migration, /is_available = p_is_available[\s\S]*is_published = p_is_published/i);
  assert.match(migration, /is distinct from/i);
  assert.match(migration, /grant execute on function public\.update_product_status[\s\S]*to authenticated/i);
});
