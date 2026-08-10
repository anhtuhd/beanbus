import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const page = readFileSync('app/admin/requests/[id]/page.tsx', 'utf8');
const directory = readFileSync('app/admin/requests/page.tsx', 'utf8');

test('admin request detail is guarded, typed, and read-only apart from status action', () => {
  assert.match(page, /await requireAdmin\(\)/);
  assert.match(page, /if \(!UUID\.test\(id\)\) notFound\(\)/);
  assert.match(page, /from\('booking_requests'\)[\s\S]*\.select\(/);
  assert.match(page, /from\('customer_requests'\)[\s\S]*\.select\(/);
  assert.match(page, /RequestStatusForm/);
  assert.match(page, /notification_status/);
  assert.match(page, /requestTypeLabel/);
  assert.match(page, /volumeLabel/);
  assert.match(page, /booking_request_status_history/);
  assert.match(page, /customer_request_status_history/);
  assert.match(page, /RequestHistory/);
  assert.doesNotMatch(page, /\.insert\(|\.update\(|\.delete\(/);
});

test('admin request lists link to booking and customer request details', () => {
  assert.match(directory, /\/admin\/requests\/\$\{booking\.id\}\?kind=booking/);
  assert.match(directory, /\/admin\/requests\/\$\{request\.id\}\?kind=customer/);
});
