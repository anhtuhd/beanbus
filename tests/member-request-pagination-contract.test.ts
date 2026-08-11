import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const migrationName = readdirSync('supabase/migrations').find((name) => name.endsWith('_member_request_pagination.sql'));
const migration = migrationName ? readFileSync(`supabase/migrations/${migrationName}`, 'utf8') : '';
const query = readFileSync('lib/account/queries.ts', 'utf8');
const types = readFileSync('lib/supabase/database.types.ts', 'utf8');

test('member request pagination is a bounded, RLS-aware database contract', () => {
  assert.ok(migrationName, 'member request pagination migration exists');
  assert.match(migration, /create function public\.get_member_requests/i);
  assert.match(migration, /create function public\.get_member_request_count/i);
  assert.match(migration, /auth\.uid\(\)/i);
  assert.match(migration, /current_user_role\(\)/i);
  assert.match(migration, /p_page_size[^\n]*between 1 and 50/i);
  assert.match(migration, /set search_path = ''/i);
  assert.match(migration, /create index if not exists booking_requests_user_created_idx/i);
  assert.match(migration, /create index if not exists customer_requests_user_created_idx/i);
  assert.match(migration, /revoke all on function public\.get_member_requests/i);
  assert.match(migration, /grant execute on function public\.get_member_requests[^\n]*authenticated/i);
});

test('member account fetches only the requested request page', () => {
  assert.match(query, /rpc\('get_member_requests'/i);
  assert.match(query, /rpc\('get_member_request_count'/i);
  assert.doesNotMatch(query, /requestPage \* REQUEST_PAGE_SIZE/);
  assert.doesNotMatch(query, /allRequests\.slice/);
  assert.match(types, /get_member_requests:/i);
  assert.match(types, /get_member_request_count:/i);
});
