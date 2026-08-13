import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const page = readFileSync('app/admin/orders/[id]/page.tsx', 'utf8');
const directory = readFileSync('app/admin/orders/page.tsx', 'utf8');

test('admin order detail is guarded, read-only, and exposes audited history', () => {
  assert.match(page, /await requireAdmin\(\)/);
  assert.match(page, /order_items\([\s\S]*order_item_options\(/);
  assert.match(page, /order_status_history\(/);
  assert.equal((page.match(/\.from\(/g) ?? []).length, 1);
  assert.match(page, /OrderStatusForm/);
  assert.match(page, /PAYMENT_METHOD_LABEL/);
  assert.match(page, /PAYMENT_STATUS_LABEL/);
  assert.match(page, /statusLabel\(entry\.from_status\)/);
  assert.match(page, /if \(!UUID\.test\(id\)\) notFound\(\)/);
  assert.doesNotMatch(page, /\.insert\(|\.update\(|\.delete\(/);
  assert.match(directory, /\/admin\/orders\/\$\{order\.id\}/);
});
