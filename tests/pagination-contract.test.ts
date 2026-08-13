import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { boundedPage, MAX_PAGE } from '../lib/pagination.ts';

test('boundedPage rejects invalid values and caps large offsets', () => {
  assert.equal(boundedPage(Number.NaN), 1);
  assert.equal(boundedPage(0), 1);
  assert.equal(boundedPage(-4), 1);
  assert.equal(boundedPage(2.8), 2);
  assert.equal(boundedPage(MAX_PAGE + 1), MAX_PAGE);
});

test('member and admin list queries use the shared page bound', () => {
  const files = [
    'lib/account/queries.ts',
    'app/admin/orders/page.tsx',
    'app/admin/requests/page.tsx',
    'app/admin/catalog/page.tsx',
    'app/admin/content/page.tsx',
    'app/admin/members/page.tsx',
    'app/admin/rewards/page.tsx',
    'app/admin/vouchers/page.tsx',
  ];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /boundedPage/, file);
  }
});

test('public content listings and member rewards fetch bounded pages', () => {
  const account = readFileSync('lib/account/queries.ts', 'utf8');
  const content = readFileSync('lib/content/queries.ts', 'utf8');

  assert.match(account, /loyalty_rewards[\s\S]*?\.range\(\(rewardPage - 1\) \* REWARD_PAGE_SIZE/);
  assert.match(account, /rewardTotalPages/);
  assert.match(content, /loadPublishedEventsPage/);
  assert.match(content, /EVENTS_PAGE_SIZE/);
  assert.match(content, /loadPublishedBlogPage/);
  assert.match(content, /BLOG_PAGE_SIZE/);
});

test('admin notification failures expose an offset pagination contract', () => {
  const migration = readFileSync('supabase/migrations/20260813135154_notification_failure_pagination.sql', 'utf8');
  const page = readFileSync('app/admin/notifications/page.tsx', 'utf8');
  const center = readFileSync('components/notifications/NotificationCenter.tsx', 'utf8');

  assert.match(migration, /p_offset integer default 0/);
  assert.match(migration, /offset greatest\(coalesce\(p_offset, 0\), 0\)/);
  assert.match(page, /p_offset: 0/);
  assert.match(center, /loadMoreFailures/);
});
