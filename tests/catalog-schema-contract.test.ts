import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260809134537_catalog.sql', import.meta.url),
  'utf8'
);

const catalogTables = [
  'catalog_categories',
  'catalog_option_sets',
  'catalog_options',
  'products',
];

test('catalog tables use RLS with public reads and admin-managed writes', () => {
  for (const table of catalogTables) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  }

  assert.match(migration, /grant select[\s\S]*to anon, authenticated/i);
  assert.match(migration, /Public can read published products/i);
  assert.match(migration, /Admins manage products/i);
  assert.doesNotMatch(migration, /grant (insert|update|delete)[^;]*to anon/i);
});

test('catalog enforces non-negative canonical prices and published visibility', () => {
  assert.match(migration, /price_vnd integer not null check \(price_vnd >= 0\)/i);
  assert.match(migration, /extra_price_vnd integer not null default 0 check \(extra_price_vnd >= 0\)/i);
  assert.match(migration, /using \(is_published\)/i);
});

test('catalog seed contains the current menu and normalized shared options', () => {
  const productSeed = migration.match(/insert into public\.products[\s\S]*?;\s*$/i)?.[0] ?? '';
  const productIds = [...productSeed.matchAll(/^\s*\('([^']+)',/gm)].map((match) => match[1]);

  assert.equal(productIds.length, 14);
  assert.equal(new Set(productIds).size, 14);
  assert.match(migration, /'standard-drink', 'Standard drink customization'/i);
  assert.match(migration, /'size-l'[\s\S]*10000/i);
});
