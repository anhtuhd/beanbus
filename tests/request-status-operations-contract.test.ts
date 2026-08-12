import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260809155000_request_status_operations.sql', import.meta.url),
  'utf8'
);
const memberHistoryMigration = readFileSync(
  new URL('../supabase/migrations/20260810050124_member_read_request_status_history.sql', import.meta.url),
  'utf8'
);
const page = readFileSync(new URL('../app/admin/requests/page.tsx', import.meta.url), 'utf8');

test('request status changes are audited and direct updates are revoked', () => {
  assert.match(migration, /create table public\.booking_request_status_history/i);
  assert.match(migration, /create table public\.customer_request_status_history/i);
  assert.match(migration, /actor_user_id uuid not null references auth\.users/i);
  assert.match(migration, /revoke update \(status, notification_status, updated_at\) on table public\.booking_requests from authenticated/i);
  assert.match(migration, /revoke update \(status, notification_status, updated_at\) on table public\.customer_requests from authenticated/i);
});

test('booking status RPC locks rows and enforces allowed transitions', () => {
  assert.match(migration, /create function public\.update_booking_request_status/i);
  assert.match(migration, /for update/i);
  assert.match(migration, /pending:confirmed/);
  assert.match(migration, /pending:rejected/);
  assert.match(migration, /confirmed:completed/);
  assert.match(migration, /INVALID_BOOKING_TRANSITION/);
});

test('lead status RPC repeats admin authorization and keeps terminal states closed', () => {
  assert.match(migration, /create function public\.update_customer_request_status/i);
  assert.match(migration, /current_user_role\(\)\) is distinct from 'admin'/i);
  assert.match(migration, /pending:in_progress/);
  assert.match(migration, /in_progress:resolved/);
  assert.match(migration, /INVALID_REQUEST_TRANSITION/);
  assert.match(migration, /grant execute on function public\.update_customer_request_status[\s\S]*to authenticated/i);
});

test('admin requests route notification work to the notification center', () => {
  assert.doesNotMatch(page, /notification_status/);
  assert.doesNotMatch(page, /Thông báo lỗi/);
  assert.match(page, /\/admin\/notifications/);
  assert.match(page, /Trung tâm thông báo/);
});

test('members can read only their own request status history', () => {
  assert.match(memberHistoryMigration, /Members read their booking request history/i);
  assert.match(memberHistoryMigration, /booking_requests\.user_id = \(select auth\.uid\(\)\)/i);
  assert.match(memberHistoryMigration, /Members read their customer request history/i);
  assert.match(memberHistoryMigration, /customer_requests\.user_id = \(select auth\.uid\(\)\)/i);
  assert.match(memberHistoryMigration, /current_user_role\(\)\) = 'admin'/i);
});
