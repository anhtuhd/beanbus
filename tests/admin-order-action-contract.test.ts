import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const actionSource = readFileSync(new URL('../app/admin/orders/actions.ts', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('../app/admin/orders/page.tsx', import.meta.url), 'utf8');
const adminActionSources = [
  'app/admin/orders/actions.ts',
  'app/admin/requests/actions.ts',
  'app/admin/catalog/actions.ts',
  'app/admin/content/actions.ts',
].map((path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));

test('admin order action authorizes and uses only the audited status RPC', () => {
  const authorization = actionSource.indexOf('await requireAdmin()');
  const rpc = actionSource.indexOf("supabase.rpc('update_order_status'");
  assert.ok(authorization >= 0 && authorization < rpc);
  assert.match(actionSource, /try \{[\s\S]*supabase\.rpc\('update_order_status'[\s\S]*catch \{/);
  assert.doesNotMatch(actionSource, /\.update\(/);
  assert.doesNotMatch(actionSource, /payment_status\s*:/);
  assert.match(actionSource, /revalidatePath\('\/admin\/orders'\)/);
});

test('admin use-server modules do not export runtime state objects', () => {
  for (const source of adminActionSources) {
    assert.doesNotMatch(source, /export const initial\w+State/);
  }
});

test('admin order page has narrow queries, search, filters, and pagination', () => {
  assert.match(pageSource, /await requireAdmin\(\)/);
  assert.match(pageSource, /PAGE_SIZE = 20/);
  assert.match(pageSource, /normalizeVietnameseMobile\(search\)/);
  assert.match(pageSource, /\.range\(from, from \+ PAGE_SIZE - 1\)/);
  assert.match(pageSource, /OrderStatusForm/);
  assert.match(pageSource, /STATUS_LABEL/);
  assert.match(pageSource, /PAYMENT_STATUS_LABEL/);
  assert.match(pageSource, /Chờ xác nhận/);
  assert.match(pageSource, /Đã thanh toán/);
  assert.doesNotMatch(pageSource, /\.select\('\*'/);
});

test('order status action revalidates the order detail route', () => {
  assert.match(actionSource, /revalidatePath\(`\/admin\/orders\/\$\{orderId\}`\)/);
});
