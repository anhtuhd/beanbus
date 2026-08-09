import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const actionSource = readFileSync(new URL('../app/admin/orders/actions.ts', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('../app/admin/orders/page.tsx', import.meta.url), 'utf8');

test('admin order action authorizes and uses only the audited status RPC', () => {
  const authorization = actionSource.indexOf('await requireAdmin()');
  const rpc = actionSource.indexOf("supabase.rpc('update_order_status'");
  assert.ok(authorization >= 0 && authorization < rpc);
  assert.doesNotMatch(actionSource, /\.update\(/);
  assert.doesNotMatch(actionSource, /payment_status\s*:/);
  assert.match(actionSource, /revalidatePath\('\/admin\/orders'\)/);
});

test('admin order page has narrow queries, search, filters, and pagination', () => {
  assert.match(pageSource, /await requireAdmin\(\)/);
  assert.match(pageSource, /PAGE_SIZE = 20/);
  assert.match(pageSource, /normalizeVietnameseMobile\(search\)/);
  assert.match(pageSource, /\.range\(from, from \+ PAGE_SIZE - 1\)/);
  assert.match(pageSource, /OrderStatusForm/);
  assert.doesNotMatch(pageSource, /\.select\('\*'/);
});
