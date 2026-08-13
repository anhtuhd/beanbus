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

test('request status actions revalidate the detail route as well as the list', () => {
  assert.match(actionSource, /revalidatePath\(`\/admin\/requests\/\$\{requestId\}`\)/);
});

test('admin requests page is guarded, filtered, and paginated', () => {
  assert.match(pageSource, /await requireAdmin\(\)/);
  assert.match(pageSource, /PAGE_SIZE = 20/);
  assert.match(pageSource, /normalizeVietnameseMobile\(search\)/);
  assert.match(pageSource, /\.from\('admin_request_feed'\)/);
  assert.match(pageSource, /\.range\(from, to\)/);
  assert.match(pageSource, /RequestStatusForm/);
  assert.doesNotMatch(pageSource, /notification_status', 'failed'/);
  assert.doesNotMatch(pageSource, /Thông báo lỗi/);
  assert.match(pageSource, /\/admin\/notifications/);
  assert.match(pageSource, /requestedView === 'all'/);
  assert.match(pageSource, /ALL_STATUSES/);
  assert.match(pageSource, /view === 'bookings' \? BOOKING_STATUSES : view === 'leads' \? CUSTOMER_STATUSES : ALL_STATUSES/);
  assert.match(pageSource, /pageLink\('all', 'all'/);
  assert.doesNotMatch(pageSource, /combined\.slice/);
  assert.doesNotMatch(pageSource, /Promise\.all\(\[bookingsPromise, requestsPromise\]\)/);
  assert.match(pageSource, /pageLink\(view, status, 1\)/);
  assert.doesNotMatch(pageSource, /\.select\('\*'/);
  assert.match(pageSource, /requestHeaderActions/);
  assert.match(pageSource, /resultCount/);
});
