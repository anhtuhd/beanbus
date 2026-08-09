import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../app/admin/members/page.tsx', import.meta.url), 'utf8');

test('member operations are protected, narrow, read-only, and paginated', () => {
  assert.match(source, /await requireAdmin\(\)/);
  assert.match(source, /PAGE_SIZE = 20/);
  assert.match(source, /normalizeVietnameseMobile\(search\)/);
  assert.match(source, /\.range\(from, from \+ PAGE_SIZE - 1\)/);
  assert.doesNotMatch(source, /\.select\('\*'/);
  assert.doesNotMatch(source, /\.update\(|\.insert\(|\.delete\(/);
  assert.doesNotMatch(source, /current_points|update_role/i);
});
