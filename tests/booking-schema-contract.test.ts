import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260809150500_booking_requests.sql', import.meta.url),
  'utf8'
);

test('booking requests default to pending and record consent without notification claims', () => {
  assert.match(migration, /status text not null default 'pending'/i);
  assert.match(migration, /consent_to_contact boolean not null/i);
  assert.match(migration, /notification_status text not null default 'not_configured'/i);
});

test('booking creation is idempotent, rate-limited, and validates reservation windows', () => {
  assert.match(migration, /idempotency_key uuid not null unique/i);
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(p_customer_phone, 0\)\)/i);
  assert.match(migration, /created_at > now\(\) - interval '1 hour'[\s\S]*>= 3/i);
  assert.match(migration, /p_reservation_at < now\(\) \+ interval '30 minutes'/i);
  assert.match(migration, /p_reservation_at > now\(\) \+ interval '90 days'/i);
});

test('booking rows are private and only owners or admins can read them', () => {
  assert.match(migration, /alter table public\.booking_requests enable row level security/i);
  assert.match(migration, /revoke all on table public\.booking_requests from anon, authenticated/i);
  assert.match(migration, /auth\.uid\(\)\) = user_id[\s\S]*current_user_role\(\)\) = 'admin'/i);
  assert.match(migration, /grant execute on function public\.create_booking_request[\s\S]*to anon, authenticated/i);
});
