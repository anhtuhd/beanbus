import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const accountError = readFileSync('app/account/error.tsx', 'utf8');
const adminError = readFileSync('app/admin/error.tsx', 'utf8');
const homeError = readFileSync('app/error.tsx', 'utf8');

test('account and admin routes expose retryable accessible error states', () => {
  for (const source of [accountError, adminError]) {
    assert.match(source, /'use client'/);
    assert.match(source, /reset: \(\) => void/);
    assert.match(source, /onClick=\{reset\}/);
    assert.match(source, /role="alert"/);
    assert.match(source, /href="\/"/);
    assert.match(source, /Thử lại/);
  }
});

test('home route exposes a retryable fallback when production catalog loading fails', () => {
  assert.match(homeError, /'use client'/);
  assert.match(homeError, /reset: \(\) => void/);
  assert.match(homeError, /onClick=\{reset\}/);
  assert.match(homeError, /role="alert"/);
  assert.match(homeError, /href="\/menu"/);
  assert.match(homeError, /Thử lại/);
});
