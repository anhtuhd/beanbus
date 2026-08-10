import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const page = readFileSync('app/about/page.tsx', 'utf8');
const client = readFileSync('app/about/AboutClient.tsx', 'utf8');

test('about route keeps metadata in a server component and isolates language UI', () => {
  assert.match(page, /export const metadata: Metadata/);
  assert.match(page, /canonical: '\/about'/);
  assert.match(page, /openGraph:/);
  assert.match(page, /<AboutClient \/>/);
  assert.match(client, /^'use client';/);
  assert.match(client, /useLanguage/);
});
