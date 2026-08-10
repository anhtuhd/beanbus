import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const page = readFileSync('app/admin/members/[id]/page.tsx', 'utf8');
const directory = readFileSync('app/admin/members/page.tsx', 'utf8');

test('admin member detail is guarded, narrow, and read-only', () => {
  assert.match(page, /await requireAdmin\(\)/);
  assert.match(page, /get_member_loyalty_summary/);
  assert.match(page, /from\('loyalty_ledger'\)\.select\(/);
  assert.match(page, /from\('orders'\)\.select\(/);
  assert.match(page, /from\('member_role_history'\)\.select\(/);
  assert.match(page, /Lịch sử quyền/);
  assert.match(page, /ledgerPage/);
  assert.match(page, /orderPage/);
  assert.match(page, /count: 'exact'/);
  assert.match(page, /Phân trang lịch sử điểm/);
  assert.match(page, /Phân trang đơn hàng hội viên/);
  assert.doesNotMatch(page, /\.insert\(|\.update\(|\.delete\(/);
  assert.match(page, /if \(!UUID\.test\(id\)\) notFound\(\)/);
  assert.match(directory, /\/admin\/members\/\$\{member\.id\}/);
});
