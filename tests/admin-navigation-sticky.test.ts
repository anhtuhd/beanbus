import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const navigation = readFileSync(
  new URL('../app/admin/AdminSectionNav.tsx', import.meta.url),
  'utf8',
);
const styles = readFileSync(
  new URL('../app/admin/admin.module.css', import.meta.url),
  'utf8',
);

test('admin navigation stays below the fixed site header on desktop only', () => {
  assert.match(navigation, /styles\.adminNavSticky/);
  assert.match(
    styles,
    /@media \(min-width: 1025px\) \{[\s\S]*?\.adminNavSticky \{[\s\S]*?position: sticky;[\s\S]*?top: 78px;[\s\S]*?z-index:/,
  );
  assert.match(styles, /@media \(max-width: 1024px\) \{/);
});
