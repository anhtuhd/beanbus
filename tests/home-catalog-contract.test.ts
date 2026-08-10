import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const page = readFileSync('app/page.tsx', 'utf8');
const client = readFileSync('app/HomeClient.tsx', 'utf8');
const catalogFallback = readFileSync('components/catalog/CatalogUnavailable.tsx', 'utf8');

test('home route loads production catalog in a server shell', () => {
  assert.doesNotMatch(page, /['"]use client['"]/);
  assert.match(page, /getCatalog\(\)/);
  assert.match(page, /getAppMode\(\)/);
  assert.match(page, /<HomeClient products=\{catalog\.products\}/);
  assert.match(client, /products\.filter/);
  assert.doesNotMatch(client, /PRODUCTS\.filter/);
  assert.match(page, /try \{/);
  assert.match(page, /CatalogUnavailable/);
  assert.match(catalogFallback, /role="alert"/);
  assert.match(catalogFallback, /href="\/contact"/);
});

test('home keeps the B2B quote flow as an interactive island', () => {
  assert.match(client, /createCustomerRequest/);
  assert.match(client, /handleSendQuote/);
  assert.match(client, /quoteModalOpen/);
  assert.match(client, /ProductCustomizerModal/);
});
