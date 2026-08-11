import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');

test('root layout tolerates browser-injected attributes on html and body', () => {
  assert.match(layout, /<html[^>]*suppressHydrationWarning/);
  assert.match(layout, /<body[^>]*suppressHydrationWarning/);
});

test('root layout schedules the javascript marker before interactive content', () => {
  assert.match(layout, /from 'next\/script'/);
  assert.match(layout, /id="set-js-class" strategy="beforeInteractive"/);
});
