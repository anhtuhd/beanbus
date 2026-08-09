import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const actionSource = readFileSync(new URL('../app/admin/catalog/actions.ts', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('../app/admin/catalog/page.tsx', import.meta.url), 'utf8');

test('admin catalog action authorizes and uses only the audited status RPC', () => {
  const authorization = actionSource.indexOf('await requireAdmin()');
  const rpc = actionSource.indexOf("supabase.rpc('update_product_status'");
  assert.ok(authorization >= 0 && authorization < rpc);
  assert.doesNotMatch(actionSource, /\.update\(/);
  assert.match(actionSource, /revalidatePath\('\/admin\/catalog'\)/);
  assert.match(actionSource, /revalidatePath\('\/menu'\)/);
});

test('admin catalog page has narrow queries, search, filters, and pagination', () => {
  assert.match(pageSource, /await requireAdmin\(\)/);
  assert.match(pageSource, /PAGE_SIZE = 20/);
  assert.match(pageSource, /\.ilike\('name_vi'/);
  assert.match(pageSource, /\.range\(from, from \+ PAGE_SIZE - 1\)/);
  assert.match(pageSource, /ProductStatusForm/);
  assert.doesNotMatch(pageSource, /\.select\('\*'/);
});
