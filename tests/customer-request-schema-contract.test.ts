import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260809153500_customer_requests.sql', import.meta.url),
  'utf8'
);
const capacityMigration = readFileSync(
  new URL('../supabase/migrations/20260810035000_rsvp_capacity.sql', import.meta.url),
  'utf8'
);

test('customer requests are typed, consent-aware, and honest about delivery', () => {
  assert.match(migration, /request_type text not null[\s\S]*'contact'[\s\S]*'rsvp'[\s\S]*'b2b_quote'/i);
  assert.match(migration, /consent_to_contact boolean not null check \(consent_to_contact\)/i);
  assert.match(migration, /status text not null default 'pending'/i);
  assert.match(migration, /notification_status text not null default 'not_configured'/i);
});

test('customer request creation is idempotent and serializes its rate limit', () => {
  assert.match(migration, /idempotency_key uuid not null unique/i);
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(p_request_type \|\| ':' \|\| p_contact_phone, 0\)\)/i);
  assert.match(migration, /created_at > now\(\) - interval '1 hour'[\s\S]*>= 3/i);
});

test('customer request rows are private and admin updates are constrained', () => {
  assert.match(migration, /alter table public\.customer_requests enable row level security/i);
  assert.match(migration, /revoke all on table public\.customer_requests from anon, authenticated/i);
  assert.match(migration, /grant update \(status, notification_status, updated_at\)/i);
  assert.match(migration, /current_user_role\(\)\) = 'admin'/i);
  assert.match(migration, /grant execute on function public\.create_customer_request[\s\S]*to anon, authenticated/i);
});

test('RSVP capacity is checked under an event lock and rejects closed/full events', () => {
  assert.match(capacityMigration, /create function public\.enforce_rsvp_capacity/i);
  assert.match(capacityMigration, /pg_advisory_xact_lock\(hashtextextended\('event:'/i);
  assert.match(capacityMigration, /for update/i);
  assert.match(capacityMigration, /EVENT_CLOSED/);
  assert.match(capacityMigration, /EVENT_FULL/);
  assert.match(capacityMigration, /status in \('pending', 'in_progress', 'resolved'\)/i);
  assert.match(capacityMigration, /before insert on public\.customer_requests/i);
});
