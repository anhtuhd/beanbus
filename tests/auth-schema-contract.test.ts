import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL(
    '../supabase/migrations/20260809060227_profiles_and_roles.sql',
    import.meta.url
  ),
  'utf8'
);

test('profiles migration enables RLS and keeps roles server-managed', () => {
  assert.match(migration, /alter table public\.profiles enable row level security/i);
  assert.match(
    migration,
    /grant update \(full_name, phone, birthday, avatar_url\) on table public\.profiles to authenticated/i
  );
  assert.doesNotMatch(migration, /grant update \([^)]*role[^)]*\).*authenticated/i);
  assert.match(migration, /role public\.app_role not null default 'member'/i);
});

test('new-user trigger copies display metadata without accepting a role', () => {
  const triggerBody = migration.match(
    /create function public\.handle_new_user\(\)[\s\S]*?\$\$;\s*\n\s*revoke/i
  )?.[0];

  assert.ok(triggerBody);
  assert.doesNotMatch(triggerBody, /raw_user_meta_data\s*->>\s*'role'/i);
  assert.match(triggerBody, /insert into public\.profiles \(id, full_name, phone, email, avatar_url\)/i);
});

test('role lookup is a locked security-definer function scoped to the caller', () => {
  assert.match(
    migration,
    /create function public\.current_user_role\(\)[\s\S]*security definer[\s\S]*set search_path = ''[\s\S]*where id = \(select auth\.uid\(\)\)/i
  );
  assert.match(migration, /revoke all on function public\.current_user_role\(\) from public/i);
});
