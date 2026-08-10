import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const migration = readFileSync('supabase/migrations/20260810070000_member_cancel_booking.sql', 'utf8');
const action = readFileSync('app/account/booking-actions.ts', 'utf8');
const form = readFileSync('app/account/requests/CancelBookingForm.tsx', 'utf8');
const accountClient = readFileSync('app/account/AccountClient.tsx', 'utf8');
const detailPage = readFileSync('app/account/requests/[id]/page.tsx', 'utf8');

test('member booking cancellation is an owned, locked, audited RPC', () => {
  assert.match(migration, /create function public\.cancel_owned_booking_request\(p_request_id uuid\)/i);
  assert.match(migration, /security definer[\s\S]*set search_path = ''/i);
  assert.match(migration, /user_id = v_user_id[\s\S]*for update/i);
  assert.match(migration, /status not in \('pending', 'confirmed'\)/i);
  assert.match(migration, /booking_request_status_history/);
  assert.match(migration, /revoke all on function public\.cancel_owned_booking_request\(uuid\) from public/i);
  assert.match(migration, /grant execute on function public\.cancel_owned_booking_request\(uuid\) to authenticated/i);
});

test('member cancellation action uses the RPC and refreshes owned request views', () => {
  assert.match(action, /getCurrentProfile/);
  assert.match(action, /supabase\.rpc\('cancel_owned_booking_request'/);
  assert.match(action, /BOOKING_CANNOT_CANCEL/);
  assert.match(action, /BOOKING_NOT_FOUND/);
  assert.match(action, /revalidatePath\('\/account'\)/);
  assert.match(action, /revalidatePath\(`\/account\/requests\/\$\{requestId\}`\)/);
});

test('member booking cancellation is available in list and detail views with live feedback', () => {
  assert.match(form, /cancelMemberBooking/);
  assert.match(form, /useActionState\(action/);
  assert.match(form, /currentStatus/);
  assert.match(form, /role=\{state\.status === 'error' \? 'alert' : 'status'\}/);
  assert.match(accountClient, /<CancelBookingForm requestId=\{request\.id\} currentStatus=\{request\.status\} kind=\{request\.kind\} \/>/);
  assert.match(detailPage, /<CancelBookingForm requestId=\{booking\.id\} currentStatus=\{booking\.status\} \/>/);
});
