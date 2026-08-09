import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sitemap = readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8');
const robots = readFileSync(new URL('../app/robots.ts', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
const productPage = readFileSync(new URL('../app/menu/[id]/page.tsx', import.meta.url), 'utf8');

test('sitemap uses configured origin and published dynamic content', () => {
  assert.match(sitemap, /getSiteUrl\(\)/);
  assert.match(sitemap, /getCatalog\(\)/);
  assert.match(sitemap, /getPublishedEvents\(\)/);
  assert.match(sitemap, /getPublishedBlogPosts\(\)/);
  assert.doesNotMatch(sitemap, /\/admin|\/account|\/order\/confirmation/);
});

test('robots keeps private workflows out of search results', () => {
  assert.match(robots, /'\/admin\/'/);
  assert.match(robots, /'\/account\/'/);
  assert.match(robots, /'\/order\/checkout'/);
  assert.match(robots, /sitemap: `\$\{siteUrl\}\/sitemap\.xml`/);
});

test('root metadata and local business data use the configured site URL', () => {
  assert.match(layout, /metadataBase: new URL\(siteUrl\)/);
  assert.match(layout, /'@type': 'CafeOrCoffeeShop'/);
  assert.match(layout, /application\/ld\+json/);
});

test('product detail publishes canonical metadata and Product structured data', () => {
  assert.match(productPage, /alternates: \{ canonical: `\/menu\/\$\{product\.id\}` \}/);
  assert.match(productPage, /'@type': 'Product'/);
  assert.match(productPage, /'@type': 'Offer'/);
  assert.match(productPage, /application\/ld\+json/);
});
