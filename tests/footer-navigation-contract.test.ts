import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const footer = readFileSync('components/layout/Footer.tsx', 'utf8');

test('footer does not expose internal payment or admin links', () => {
  assert.doesNotMatch(footer, /href="\/order\/checkout"/);
  assert.doesNotMatch(footer, /href="\/admin"/);
  assert.doesNotMatch(footer, /Thanh Toán Sepay|Sepay QR Checkout/);
  assert.doesNotMatch(footer, /Quản trị Admin|Admin Portal/);
});
