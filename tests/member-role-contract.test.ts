import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const migration = readFileSync('supabase/migrations/20260810030304_member_role_operations.sql', 'utf8');
const action = readFileSync('app/admin/members/actions.ts', 'utf8');
const page = readFileSync('app/admin/members/page.tsx', 'utf8');
const detail = readFileSync('app/admin/members/[id]/page.tsx', 'utf8');

test('member role changes are admin-only, audited, and prevent self-demotion', () => {
  assert.match(migration, /create function public\.update_member_role[\s\S]*security definer/i);
  assert.match(migration, /current_user_role\(\)\) is distinct from 'admin'/i);
  assert.match(migration, /SELF_DEMOTION_FORBIDDEN/i);
  assert.match(migration, /member_role_history/i);
  assert.match(action, /await requireAdmin\(\)/);
  assert.match(action, /rpc\('update_member_role'/);
  assert.match(action, /revalidatePath\(`\/admin\/members\/\$\{userId\}`\)/);
});

test('member directory routes editing to the member detail page', () => {
  assert.doesNotMatch(page, /MemberRoleForm/);
  assert.match(page, /Chỉnh sửa/);
  assert.match(page, /editMemberLink/);
  assert.match(page, /select\('id, member_number, full_name, phone, email, birthday, role, created_at'/);
  assert.match(detail, /MemberRoleForm/);
  assert.match(detail, /member-edit-title/);
});
