import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../lib/content/queries.ts', import.meta.url), 'utf8');

test('production content queries use Supabase and narrow selects', () => {
  assert.match(source, /getAppMode\(\) === 'demo'/);
  assert.match(source, /\.from\('events'\)/);
  assert.match(source, /\.from\('blog_posts'\)/);
  assert.doesNotMatch(source, /\.select\('\*'/);
  assert.match(source, /\.eq\('is_published', true\)/);
});
test('detail queries are bounded by stable public identifiers', () => {
  assert.match(source, /export async function getPublishedEvent\(id: string\)/);
  assert.match(source, /\.eq\('id', id\)/);
  assert.match(source, /export async function getPublishedBlogPost\(slug: string\)/);
  assert.match(source, /\.eq\('slug', slug\)/);
});
