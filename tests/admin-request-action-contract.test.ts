import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const actionSource = readFileSync(new URL('../app/admin/requests/actions.ts', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('../app/admin/requests/page.tsx', import.meta.url), 'utf8');

test('admin request actions authorize before calling audited RPCs', () => {
  const authorization = actionSource.indexOf('await requireAdmin()');
  const bookingRpc = actionSource.indexOf("supabase.rpc('update_booking_request_status'");
  const customerRpc = actionSource.indexOf("supabase.rpc('update_customer_request_status'");

  assert.ok(authorization >= 0 && authorization < bookingRpc);
  assert.ok(actionSource.indexOf('await requireAdmin()', bookingRpc) < customerRpc);
  assert.doesNotMatch(actionSource, /\.from\([^)]*\)\.update\(/);
  assert.match(actionSource, /revalidatePath\('\/admin\/requests'\)/);
});

test('admin requests page is guarded, filtered, and paginated', () => {
  assert.match(pageSource, /await requireAdmin\(\)/);
  assert.match(pageSource, /PAGE_SIZE = 20/);
  assert.match(pageSource, /normalizeVietnameseMobile\(search\)/);
  assert.match(pageSource, /\.range\(from, to\)/);
  assert.match(pageSource, /RequestStatusForm/);
  assert.doesNotMatch(pageSource, /\.select\('\*'/);
});
