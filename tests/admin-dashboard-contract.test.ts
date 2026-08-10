import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const page = readFileSync('app/admin/page.tsx', 'utf8');
const demoClient = readFileSync('app/admin/AdminClient.tsx', 'utf8');
const css = readFileSync('app/admin/admin.module.css', 'utf8');

test('production admin dashboard is guarded and surfaces notification failures', () => {
  assert.match(page, /await requireAdmin\(\)/);
  assert.match(page, /notification_status', 'failed'/g);
  assert.match(page, /Thông báo lỗi/);
  assert.match(page, /failedBookings\.count/);
  assert.match(page, /failedLeads\.count/);
  assert.match(page, /\/admin\/requests\?view=all&notification=failed/);
  assert.match(page, /href="\/admin\/orders"/);
  assert.match(page, /href="\/admin\/orders\?status=pending"/);
  assert.match(page, /href="\/admin\/requests\?view=all&status=pending"/);
  assert.match(page, /href="\/admin\/members"/);
  assert.match(css, /grid-template-columns: repeat\(5, 1fr\)/);
});

test('demo admin clearly identifies browser-only fixture data', () => {
  assert.match(demoClient, /Demo mode/);
  assert.match(demoClient, /Browser-only data/);
  assert.match(demoClient, /role="status"/);
  assert.doesNotMatch(demoClient, /beanbus\.vn Portal/);
});

test('demo admin tabs expose accessible panels and keyboard navigation', () => {
  assert.match(demoClient, /role="tablist"/);
  assert.match(demoClient, /role="tab"/);
  assert.match(demoClient, /role="tabpanel"/);
  assert.match(demoClient, /aria-controls="admin-orders-panel"/);
  assert.match(demoClient, /aria-labelledby="admin-orders-tab"/);
  assert.match(demoClient, /handleTabKeyDown/);
  assert.match(demoClient, /tabRefs\.current\[nextTab\]\?\.focus\(\)/);
});

test('demo admin product modal uses the shared focus and dialog semantics', () => {
  assert.match(demoClient, /useDialogFocus/);
  assert.match(demoClient, /role="dialog"/);
  assert.match(demoClient, /aria-modal="true"/);
  assert.match(demoClient, /aria-labelledby="new-product-title"/);
  assert.match(demoClient, /newProductDialogRef/);
});
