import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const layout = readFileSync('app/layout.tsx', 'utf8');
const orders = readFileSync('context/OrderContext.tsx', 'utf8');
const settings = readFileSync('context/StoreSettingsContext.tsx', 'utf8');

test('production layout disables demo provider persistence', () => {
  assert.match(layout, /<StoreSettingsProvider mode=\{appMode\}>/);
  assert.match(layout, /<OrderProvider mode=\{appMode\}>/);
  assert.match(orders, /const isDemo = mode === 'demo';/);
  assert.match(settings, /const isDemo = mode === 'demo';/);
  assert.match(orders, /if \(!isDemo\) return;/);
  assert.match(settings, /if \(!isDemo\) return;/);
});

test('demo provider defaults remain available for local workflows', () => {
  assert.match(orders, /mode = 'demo'/);
  assert.match(orders, /isDemo \? INITIAL_ORDERS : \[\]/);
  assert.match(settings, /mode = 'demo'/);
  assert.match(settings, /isDemo \? DEFAULT_FLASH_SALES : \[\]/);
});
