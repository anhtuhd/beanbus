import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const catalog = readFileSync('lib/catalog/queries.ts', 'utf8');
const content = readFileSync('lib/content/queries.ts', 'utf8');
const cacheTags = readFileSync('lib/cache/tags.ts', 'utf8');
const catalogActions = readFileSync('app/admin/catalog/product-actions.ts', 'utf8');
const contentActions = readFileSync('app/admin/content/event-actions.ts', 'utf8');

test('public catalog and content queries use shared tagged data cache', () => {
  assert.match(catalog, /unstable_cache/);
  assert.match(catalog, /CATALOG_CACHE_TAG/);
  assert.match(content, /unstable_cache/);
  assert.match(content, /EVENTS_CACHE_TAG/);
  assert.match(content, /BLOG_CACHE_TAG/);
});

test('admin mutations invalidate the matching public cache tag', () => {
  assert.match(cacheTags, /updateTag/);
  assert.match(catalogActions, /invalidateCatalogCache/);
  assert.match(contentActions, /invalidateEventsCache/);
});
