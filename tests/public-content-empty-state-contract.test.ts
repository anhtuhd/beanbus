import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const eventsClient = readFileSync(new URL('../app/events/EventsClient.tsx', import.meta.url), 'utf8');
const blogClient = readFileSync(new URL('../app/blog/BlogListClient.tsx', import.meta.url), 'utf8');

test('public content lists expose honest empty states', () => {
  assert.match(eventsClient, /events\.length === 0/);
  assert.match(eventsClient, /No upcoming events/);
  assert.match(eventsClient, /role="status"/);
  assert.match(blogClient, /posts\.length === 0/);
  assert.match(blogClient, /No articles yet/);
  assert.match(blogClient, /role="status"/);
});
