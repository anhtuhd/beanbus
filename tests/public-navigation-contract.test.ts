import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const header = readFileSync('components/layout/Header.tsx', 'utf8');
const about = readFileSync('app/about/AboutClient.tsx', 'utf8');

test('Beanbus about navigation keeps every submenu on the about route', () => {
  assert.match(header, /href: '\/about#top'/);
  assert.match(header, /href: '\/about#story'/);
  assert.match(header, /href: '\/about#process'/);
  assert.match(header, /href: '\/about#roastery'/);
  assert.doesNotMatch(header, /href: '\/#story'/);
  assert.doesNotMatch(header, /href: '\/#beans'/);
});

test('about sections expose stable anchors for header navigation', () => {
  assert.match(about, /id="top"/);
  assert.match(about, /id="story"/);
  assert.match(about, /id="process"/);
  assert.match(about, /id="roastery"/);
});
