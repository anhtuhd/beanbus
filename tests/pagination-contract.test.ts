import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { boundedPage, MAX_PAGE } from '../lib/pagination.ts';

test('boundedPage rejects invalid values and caps large offsets', () => {
  assert.equal(boundedPage(Number.NaN), 1);
  assert.equal(boundedPage(0), 1);
  assert.equal(boundedPage(-4), 1);
  assert.equal(boundedPage(2.8), 2);
  assert.equal(boundedPage(MAX_PAGE + 1), MAX_PAGE);
});

test('member and admin list queries use the shared page bound', () => {
  const files = [
    'lib/account/queries.ts',
    'app/admin/orders/page.tsx',
    'app/admin/requests/page.tsx',
    'app/admin/catalog/page.tsx',
    'app/admin/content/page.tsx',
    'app/admin/members/page.tsx',
    'app/admin/rewards/page.tsx',
    'app/admin/vouchers/page.tsx',
  ];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /boundedPage/, file);
  }
});
