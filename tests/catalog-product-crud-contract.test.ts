import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const migration = readFileSync('supabase/migrations/20260810031403_catalog_product_crud.sql', 'utf8');
const action = readFileSync('app/admin/catalog/product-actions.ts', 'utf8');
const page = readFileSync('app/admin/catalog/page.tsx', 'utf8');
const form = readFileSync('app/admin/catalog/ProductEditorForm.tsx', 'utf8');
const statusAction = readFileSync('app/admin/catalog/actions.ts', 'utf8');
const statusForm = readFileSync('app/admin/catalog/ProductStatusForm.tsx', 'utf8');
const archiveMigration = readFileSync('supabase/migrations/20260810034000_catalog_archive.sql', 'utf8');

test('catalog product CRUD is admin-only, validated, and audited', () => {
  assert.match(migration, /create table public\.product_change_history/i);
  assert.match(migration, /create function public\.admin_upsert_product/i);
  assert.match(migration, /security definer[\s\S]*set search_path = ''/i);
  assert.match(migration, /current_user_role\(\)\) is distinct from 'admin'/i);
  assert.match(migration, /insert into public\.product_change_history/i);
  assert.match(migration, /grant execute on function public\.admin_upsert_product[\s\S]*to authenticated/i);
});

test('catalog editor validates in the action and uses the RPC boundary', () => {
  assert.match(action, /requireAdmin\(\)/);
  assert.match(action, /Number\.isInteger\(priceVnd\)/);
  assert.match(action, /supabase\.rpc\('admin_upsert_product'/);
  assert.doesNotMatch(action, /\.from\('products'\)\.(insert|update|delete)/i);
  assert.match(page, /ProductEditorForm/);
  assert.match(form, /name="productId"/);
  assert.doesNotMatch(form, /productIdDisplay/);
});

test('catalog archive preserves historical product references', () => {
  assert.match(archiveMigration, /create function public\.admin_archive_product/i);
  assert.match(archiveMigration, /set is_available = false, is_published = false/i);
  assert.match(archiveMigration, /product_status_history/i);
  assert.match(statusAction, /admin_archive_product/);
  assert.match(statusAction, /archive_catalog_product/);
  assert.match(statusForm, /name="intent" value="archive"/);
});
