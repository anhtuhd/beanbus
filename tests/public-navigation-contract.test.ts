import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNavHrefActive } from '../components/layout/navigation.ts';

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

test('about submenu active state matches the current hash only', () => {
  assert.equal(isNavHrefActive('/about#story', '/about', '#story'), true);
  assert.equal(isNavHrefActive('/about#top', '/about', '#story'), false);
  assert.equal(isNavHrefActive('/about#process', '/about', ''), false);
  assert.equal(isNavHrefActive('/about#top', '/about', ''), true);
  assert.equal(isNavHrefActive('/menu', '/about', ''), false);
});
