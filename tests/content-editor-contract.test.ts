import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const migration = readFileSync('supabase/migrations/20260810031827_content_editor.sql', 'utf8');
const action = readFileSync('app/admin/content/event-actions.ts', 'utf8');
const blogAction = readFileSync('app/admin/content/blog-actions.ts', 'utf8');
const page = readFileSync('app/admin/content/page.tsx', 'utf8');

test('event editor is admin-only, validated, and change-audited', () => {
  assert.match(migration, /create table public\.content_change_history/i);
  assert.match(migration, /create function public\.admin_upsert_event/i);
  assert.match(migration, /security definer[\s\S]*set search_path = ''/i);
  assert.match(migration, /current_user_role\(\)\) is distinct from 'admin'/i);
  assert.match(migration, /insert into public\.content_change_history/i);
  assert.match(migration, /grant execute on function public\.admin_upsert_event[\s\S]*to authenticated/i);
});

test('event editor validates local time and uses the RPC boundary', () => {
  assert.match(action, /requireAdmin\(\)/);
  assert.match(action, /parseVietnamDateTime/);
  assert.match(action, /supabase\.rpc\('admin_upsert_event'/);
  assert.doesNotMatch(action, /\.from\('events'\)\.(insert|update|delete)/i);
  assert.match(page, /EventEditorForm/);
});

test('blog editor shares the admin RPC and change audit boundary', () => {
  assert.match(migration, /create function public\.admin_upsert_blog_post/i);
  assert.match(migration, /grant execute on function public\.admin_upsert_blog_post[\s\S]*to authenticated/i);
  assert.match(blogAction, /requireAdmin\(\)/);
  assert.match(blogAction, /supabase\.rpc\('admin_upsert_blog_post'/);
  assert.doesNotMatch(blogAction, /\.from\('blog_posts'\)\.(insert|update|delete)/i);
  assert.match(page, /BlogEditorForm/);
});
