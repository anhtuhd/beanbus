import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const page = readFileSync('app/order/page.tsx', 'utf8');
const client = readFileSync('app/order/OrderClient.tsx', 'utf8');
const loading = readFileSync('app/order/loading.tsx', 'utf8');
const error = readFileSync('app/order/error.tsx', 'utf8');
const catalogFallback = readFileSync('components/catalog/CatalogUnavailable.tsx', 'utf8');

test('order route loads the production catalog in the server shell', () => {
  assert.doesNotMatch(page, /['"]use client['"]/);
  assert.match(page, /getCatalog\(\)/);
  assert.match(page, /getAppMode\(\)/);
  assert.match(page, /OrderPageView categories=\{catalog\.categories\} products=\{catalog\.products\}/);
  assert.match(page, /<OrderClient categories=\{categories\} products=\{products\}/);
  assert.match(client, /catalogProducts\.filter/);
  assert.doesNotMatch(client, /PRODUCTS\.filter/);
});

test('order route exposes honest empty, loading, error, and no-JavaScript states', () => {
  assert.match(client, /Danh mục này hiện chưa có món/);
  assert.match(page, /OrderNoScript/);
  assert.match(loading, /Đang tải thực đơn/);
  assert.match(error, /Không thể tải thực đơn/);
  assert.match(error, /onClick=\{reset\}/);
  assert.match(page, /CatalogUnavailable/);
  assert.match(page, /Chưa thể tải thực đơn đặt món/);
  assert.match(catalogFallback, /role="alert"/);
});

test('order summary reports subtotal instead of the post-discount total', () => {
  assert.match(client, /const \{ cart, cartCount, subtotal, syncCatalog \} = useCart\(\)/);
  assert.match(client, /Tạm tính/);
  assert.match(client, /formatVnd\(subtotal\)/);
});
