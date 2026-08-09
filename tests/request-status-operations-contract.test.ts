import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260809155000_request_status_operations.sql', import.meta.url),
  'utf8'
);

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
