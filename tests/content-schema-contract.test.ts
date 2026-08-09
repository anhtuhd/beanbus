import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260809164000_content.sql', import.meta.url),
  'utf8'
);

test('events and blog posts expose only published content publicly', () => {
  assert.match(migration, /create table public\.events/i);
  assert.match(migration, /create table public\.blog_posts/i);
  assert.match(migration, /alter table public\.events enable row level security/i);
  assert.match(migration, /alter table public\.blog_posts enable row level security/i);
  assert.match(migration, /using \(is_published and published_at is not null\)/i);
});

test('content mutations are denied to browser roles', () => {
  assert.match(migration, /revoke insert, update, delete on table public\.events from anon, authenticated/i);
  assert.match(migration, /revoke insert, update, delete on table public\.blog_posts from anon, authenticated/i);
  assert.match(migration, /grant all on table public\.events, public\.blog_posts to service_role/i);
});

test('content schema validates URLs, slugs, dates, and event capacity', () => {
  assert.match(migration, /slug text not null unique check \(slug ~ '\^\[a-z0-9\]\[a-z0-9-\]/i);
  assert.match(migration, /image_url text not null check \(image_url ~ '\^https:\/\/'\)/i);
  assert.match(migration, /max_seats is null or max_seats > 0/i);
  assert.match(migration, /ends_at is null or ends_at > starts_at/i);
});
