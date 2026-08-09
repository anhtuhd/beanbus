import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260809165000_content_operations.sql', import.meta.url),
  'utf8'
);

test('content publication changes are admin-only and audited', () => {
  assert.match(migration, /create table public\.content_publication_history/i);
  assert.match(migration, /create function public\.update_event_publication/i);
  assert.match(migration, /create function public\.update_blog_post_publication/i);
  assert.match(migration, /current_user_role\(\)\) is distinct from 'admin'/i);
  assert.match(migration, /actor_user_id uuid not null references auth\.users/i);
});
test('content publication RPCs lock records and are idempotent', () => {
  assert.match(migration, /from public\.events[\s\S]*for update/i);
  assert.match(migration, /from public\.blog_posts[\s\S]*for update/i);
  assert.match(migration, /is_published is not distinct from p_is_published/i);
  assert.match(migration, /grant execute on function public\.update_event_publication/i);
  assert.match(migration, /grant execute on function public\.update_blog_post_publication/i);
});
