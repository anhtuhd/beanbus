import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { BRAND_ASSETS } from '../lib/brand/assets.ts';

const sourceFiles = [
  'app/HomeClient.tsx',
  'app/about/AboutClient.tsx',
  'app/layout.tsx',
  'components/layout/Header.tsx',
  'components/layout/Footer.tsx',
  'app/login/LoginForm.tsx',
  'app/account/AccountClient.tsx',
];

test('Beanbus brand assets are stored locally', () => {
  for (const assetPath of Object.values(BRAND_ASSETS)) {
    assert.equal(existsSync(new URL(`../public${assetPath}`, import.meta.url)), true, assetPath);
  }
});

test('marketing and member surfaces do not hotlink brand imagery', () => {
  for (const file of sourceFiles) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /beanbus\.vn\/assets|images\.unsplash\.com/, file);
  }
});
