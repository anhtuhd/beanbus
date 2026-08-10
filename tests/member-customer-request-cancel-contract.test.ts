import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const migration = readFileSync('supabase/migrations/20260810073000_member_cancel_customer_request.sql', 'utf8');
const action = readFileSync('app/account/customer-request-actions.ts', 'utf8');
const form = readFileSync('app/account/requests/CancelBookingForm.tsx', 'utf8');
const accountClient = readFileSync('app/account/AccountClient.tsx', 'utf8');
const detailPage = readFileSync('app/account/requests/[id]/page.tsx', 'utf8');
const adminPage = readFileSync('app/admin/requests/page.tsx', 'utf8');

test('member customer-request cancellation is owned, locked, audited, and explicit', () => {
  assert.match(migration, /drop constraint if exists customer_requests_status_check/i);
  assert.match(migration, /status in \('pending', 'in_progress', 'resolved', 'rejected', 'cancelled'\)/i);
  assert.match(migration, /create function public\.cancel_owned_customer_request\(p_request_id uuid\)/i);
  assert.match(migration, /user_id = v_user_id[\s\S]*for update/i);
  assert.match(migration, /status not in \('pending', 'in_progress'\)/i);
  assert.match(migration, /customer_request_status_history/);
  assert.match(migration, /grant execute on function public\.cancel_owned_customer_request\(uuid\) to authenticated/i);
});

test('member customer-request action uses the protected RPC and honest errors', () => {
  assert.match(action, /getCurrentProfile/);
  assert.match(action, /supabase\.rpc\('cancel_owned_customer_request'/);
  assert.match(action, /REQUEST_CANNOT_CANCEL/);
  assert.match(action, /REQUEST_NOT_FOUND/);
  assert.match(action, /revalidatePath\('\/account'\)/);
});

test('member can withdraw active customer requests from list and detail views', () => {
  assert.match(form, /cancelMemberCustomerRequest/);
  assert.match(form, /kind === 'booking' \? \['pending', 'confirmed'\] : \['pending', 'in_progress'\]/);
  assert.match(accountClient, /<CancelBookingForm requestId=\{request\.id\} currentStatus=\{request\.status\} kind=\{request\.kind\} \/>/);
  assert.match(detailPage, /<CancelBookingForm requestId=\{request\.id\} currentStatus=\{request\.status\} kind="customer" \/>/);
  assert.match(adminPage, /'cancelled'/);
});
