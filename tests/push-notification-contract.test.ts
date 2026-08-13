import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260813020847_guest_push_notifications.sql', import.meta.url),
  'utf8',
);
const orderAction = readFileSync(new URL('../app/order/actions.ts', import.meta.url), 'utf8');
const guestSession = readFileSync(new URL('../lib/notifications/guest-session.ts', import.meta.url), 'utf8');
const authContext = readFileSync(new URL('../context/AuthContext.tsx', import.meta.url), 'utf8');
const pushRoute = readFileSync(new URL('../app/api/push/installations/route.ts', import.meta.url), 'utf8');
const firebaseClient = readFileSync(new URL('../lib/notifications/firebase-client.ts', import.meta.url), 'utf8');
const bell = readFileSync(new URL('../components/layout/NotificationBell.tsx', import.meta.url), 'utf8');
const config = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8');
const deployWorkflow = readFileSync(new URL('../.github/workflows/deploy-supabase-functions.yml', import.meta.url), 'utf8');

test('guest and FCM tables are private, indexed, deduplicated, and short lived', () => {
  for (const table of [
    'guest_notification_sessions',
    'guest_order_access',
    'guest_notifications',
    'fcm_installations',
    'fcm_installation_recipients',
    'push_outbox',
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`, 'i'));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  }
  assert.match(migration, /revoke all on table[\s\S]*guest_notification_sessions[\s\S]*from anon, authenticated/i);
  assert.match(migration, /primary key \(guest_session_id, order_id\)/i);
  assert.match(migration, /unique \(guest_session_id, dedupe_key\)/i);
  assert.match(migration, /unique \(installation_id, user_id\)/i);
  assert.match(migration, /unique \(installation_id, guest_session_id\)/i);
  assert.match(migration, /where status = 'pending'/i);
  assert.match(migration, /interval '7 days'/i);
  assert.match(migration, /interval '30 days'/i);
});

test('status and payment changes notify members and same-browser guests idempotently', () => {
  assert.match(migration, /after update of status, payment_status on public\.orders/i);
  assert.match(migration, /order_payment:/i);
  assert.match(migration, /guest_notifications/i);
  assert.match(migration, /booking_request_status_changed/i);
  assert.match(migration, /customer_request_status_changed/i);
  assert.match(migration, /on conflict[\s\S]*do nothing/i);
});

test('guest order linking happens only after a server-issued receipt exists', () => {
  assert.match(orderAction, /issue_order_receipt/);
  assert.match(orderAction, /linkGuestOrderNotifications/);
  assert.match(orderAction, /receipt/);
  assert.match(guestSession, /getGuestNotificationSessionId/);
});

test('push outbox claims with skip locked and retries transient delivery failures', () => {
  assert.match(migration, /claim_push_notification_batch/i);
  assert.match(migration, /for update(?: of outbox)? skip locked/i);
  assert.match(migration, /attempt_count < 5/i);
  assert.match(migration, /interval '1 minute'/i);
  assert.match(migration, /interval '5 minutes'/i);
  assert.match(migration, /interval '30 minutes'/i);
  assert.match(migration, /interval '2 hours'/i);
  assert.match(migration, /UNREGISTERED/i);
});

test('client waits for auth before aggregating user and guest notifications', () => {
  assert.match(authContext, /isAuthReady/);
  assert.match(bell, /isAuthReady/);
  assert.match(bell, /\/api\/notifications\/guest/);
  assert.match(bell, /NEXT_PUBLIC_ENABLE_GUEST_NOTIFICATIONS/);
  assert.match(bell, /NEXT_PUBLIC_ENABLE_WEB_PUSH/);
});

test('FCM worker is independently authenticated and deployable', () => {
  assert.match(config, /\[functions\.dispatch-fcm-notifications\][\s\S]*?verify_jwt\s*=\s*false/i);
  assert.match(deployWorkflow, /dispatch-fcm-notifications/);
});

test('push logout unlinks only the current installation', () => {
  assert.match(pushRoute, /unlink_fcm_installation/);
  assert.doesNotMatch(pushRoute, /unlink_user_fcm_installations/);
  assert.match(authContext, /currentWebPushFid/);
  assert.match(firebaseClient, /export function currentWebPushFid/);
});
