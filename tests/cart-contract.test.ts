import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('context/CartContext.tsx', 'utf8');

test('cart storage is versioned and can refresh product pricing from the catalog', () => {
  assert.match(source, /CART_STORAGE_VERSION = 2/);
  assert.match(source, /syncCatalog: \(products: Product\[\]\)/);
  assert.match(source, /product\.price \+ selectedOptions\.reduce/);
});
