import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const homeShell = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const home = readFileSync(new URL('../app/HomeClient.tsx', import.meta.url), 'utf8');
const events = readFileSync(new URL('../app/events/EventsClient.tsx', import.meta.url), 'utf8');
const menuLoading = readFileSync(new URL('../app/menu/(listing)/loading.tsx', import.meta.url), 'utf8');
const eventsLoading = readFileSync(new URL('../app/events/(listing)/loading.tsx', import.meta.url), 'utf8');
const blogLoading = readFileSync(new URL('../app/blog/(listing)/loading.tsx', import.meta.url), 'utf8');
const eventDetail = readFileSync(new URL('../app/events/[id]/page.tsx', import.meta.url), 'utf8');
const blogDetail = readFileSync(new URL('../app/blog/[slug]/page.tsx', import.meta.url), 'utf8');
const productDetail = readFileSync(new URL('../app/menu/[id]/page.tsx', import.meta.url), 'utf8');

test('public interactive surfaces provide no-JavaScript navigation fallbacks', () => {
  assert.doesNotMatch(homeShell, /use client/);
  assert.match(home, /noScriptNotice/);
  assert.match(home, /href="\/menu"/);
  assert.match(home, /href="\/booking"/);
  assert.match(home, /href="\/contact"/);
  assert.match(events, /noScriptInline/);
  assert.match(menuLoading, /menu\/\$\{product\.id\}/);
  assert.match(eventsLoading, /events\/\$\{event\.id\}/);
  assert.match(eventsLoading, />Chi tiết<\/Link>/);
  assert.match(blogLoading, /blog\/\$\{post\.slug\}/);
  assert.match(blogLoading, />Đọc bài viết chi tiết<\/Link>/);
  for (const source of [eventDetail, blogDetail, productDetail]) {
    assert.match(source, /noScriptContent/);
    assert.match(source, /<h1>/);
    assert.match(source, /href="\/(events|blog|menu)"/);
  }
});
