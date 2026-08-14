import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('production admin routes share a protected navigation and demo stays on the fixture', () => {
  const layout = readFileSync('app/admin/layout.tsx', 'utf8');
  const navigation = readFileSync('app/admin/AdminSectionNav.tsx', 'utf8');

  assert.match(layout, /<AdminSectionNav \/>/);
  for (const path of [
    '/admin',
    '/admin/orders',
    '/admin/requests',
    '/admin/catalog',
    '/admin/content',
    '/admin/members',
    '/admin/loyalty',
    '/admin/vouchers',
    '/admin/rewards',
    '/admin/notifications',
    '/admin/stored-value',
  ]) {
    assert.match(navigation, new RegExp(`href: '${path.replaceAll('/', '\\/')}'`), path);
  }
  assert.match(navigation, /getAppMode\(\) === 'demo'/);
  assert.doesNotMatch(navigation, /isStoredValueConfigured\(\)/);
  assert.doesNotMatch(navigation, /section\.href !== '\/admin\/stored-value'/);
  assert.match(navigation, /aria-label="Admin navigation"/);
  assert.match(navigation, /vi: 'Gói nạp điểm', en: 'Stored value'/);
});

test('admin dashboard does not advertise disabled stored-value controls', () => {
  const dashboard = readFileSync('app/admin/page.tsx', 'utf8');
  assert.match(dashboard, /isStoredValueConfigured\(\)/);
  assert.match(dashboard, /storedValueConfigured && <Link href="\/admin\/stored-value"/);
  assert.match(dashboard, /vi="Gói nạp điểm" en="Stored value"/);
});

test('admin dashboard actions stay visible and readable across widths', () => {
  const styles = readFileSync('app/admin/admin.module.css', 'utf8');
  assert.match(styles, /\.adminActions\s*\{[\s\S]*display: grid/);
  assert.match(styles, /grid-template-columns: repeat\(3, minmax\(130px, 1fr\)\)/);
  assert.match(styles, /\.adminActions :global\(\.btn\)\s*\{[\s\S]*width: 100%/);
  assert.match(styles, /\.adminActions\s*\{[\s\S]*grid-template-columns: 1fr/);
});
