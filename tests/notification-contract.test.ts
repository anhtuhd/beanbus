import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260812040545_notification_center.sql', import.meta.url),
  'utf8',
);
const config = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8');
const header = readFileSync(new URL('../components/layout/Header.tsx', import.meta.url), 'utf8');
const adminNav = readFileSync(new URL('../app/admin/AdminSectionNav.tsx', import.meta.url), 'utf8');
const adminPage = readFileSync(new URL('../app/admin/page.tsx', import.meta.url), 'utf8');
const accountNotificationsPage = readFileSync(new URL('../app/account/notifications/page.tsx', import.meta.url), 'utf8');
const adminNotificationsPage = readFileSync(new URL('../app/admin/notifications/page.tsx', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../supabase/functions/dispatch-notification-emails/index.ts', import.meta.url), 'utf8');
const webhook = readFileSync(new URL('../supabase/functions/resend-webhook/index.ts', import.meta.url), 'utf8');
const unsubscribe = readFileSync(new URL('../supabase/functions/email-unsubscribe/index.ts', import.meta.url), 'utf8');
const notificationBell = readFileSync(new URL('../components/layout/NotificationBell.tsx', import.meta.url), 'utf8');
const notificationCenter = readFileSync(new URL('../components/notifications/NotificationCenter.tsx', import.meta.url), 'utf8');
const databaseTypes = readFileSync(new URL('../lib/supabase/database.types.ts', import.meta.url), 'utf8');

test('notification schema isolates recipients and delivery state', () => {
  assert.match(migration, /create table public\.notifications/i);
  assert.match(migration, /recipient_user_id uuid not null references auth\.users/i);
  assert.match(migration, /unique \(recipient_user_id, dedupe_key\)/i);
  assert.match(migration, /create table public\.notification_preferences/i);
  assert.match(migration, /create table public\.email_outbox/i);
  assert.match(migration, /create table public\.email_delivery_events/i);
  assert.match(migration, /create table public\.email_suppressions/i);
  assert.match(migration, /alter table public\.notifications enable row level security/i);
  assert.match(migration, /revoke all on table public\.email_outbox, public\.email_delivery_events, public\.email_suppressions\s+from anon, authenticated/i);
});

test('notification RPCs enforce ownership and admin publication', () => {
  assert.match(migration, /create (?:or replace )?function public\.mark_notification_read\(p_notification_id uuid\)/i);
  assert.match(migration, /where id = p_notification_id\s+and recipient_user_id = \(select auth\.uid\(\)\)/i);
  assert.match(migration, /create (?:or replace )?function public\.mark_all_notifications_read\(\)/i);
  assert.match(migration, /create (?:or replace )?function public\.update_notification_preferences\(/i);
  assert.match(migration, /create (?:or replace )?function public\.publish_store_announcement\(/i);
  assert.match(migration, /is distinct from 'admin' then\s+raise exception 'ADMIN_REQUIRED'/i);
  assert.match(migration, /grant execute on function public\.publish_store_announcement/i);
});

test('order and event triggers fan out idempotent notifications', () => {
  assert.match(migration, /create trigger orders_create_notifications/i);
  assert.match(migration, /create trigger orders_status_create_notifications/i);
  assert.match(migration, /create trigger events_publish_notifications/i);
  assert.match(migration, /on conflict \(recipient_user_id, dedupe_key\) do nothing/i);
  assert.match(migration, /new\.status is not distinct from old\.status/i);
  assert.match(migration, /old\.is_published is distinct from false/i);
  assert.match(migration, /prior\.event_type in \('email\.bounced', 'email\.complained'\)/i);
});

test('email worker and feature flags are wired without public secrets', () => {
  assert.match(worker, /RESEND_API_KEY/);
  assert.match(worker, /Idempotency-Key/i);
  assert.match(worker, /claim_notification_email_batch/i);
  assert.match(worker, /Promise\.all/);
  assert.match(worker, /NOTIFICATION_EMAIL_MODE/);
  assert.match(worker, /AbortSignal\.timeout/);
  assert.match(worker, /SUPABASE_URL[\s\S]*email-unsubscribe/);
  assert.match(webhook, /getReader\(\)/);
  assert.match(webhook, /svix-id/i);
  assert.match(unsubscribe, /crypto\.subtle\.verify/);
  assert.doesNotMatch(header, /NEXT_PUBLIC_RESEND_API_KEY/);
});

test('external notification functions authenticate in their own handlers', () => {
  for (const name of ['dispatch-notification-emails', 'resend-webhook', 'email-unsubscribe']) {
    assert.match(
      config,
      new RegExp(`\\[functions\\.${name}\\][\\s\\S]*?verify_jwt\\s*=\\s*false`, 'i'),
    );
  }
});

test('marketing unsubscribe does not create a hard email suppression', () => {
  assert.match(migration, /reason text not null check \(reason in \('bounced', 'complained'\)\)/i);
  assert.doesNotMatch(
    migration,
    /insert into public\.email_suppressions[\s\S]*?values \(v_email, 'unsubscribed'\)/i,
  );
  assert.match(migration, /email_event_updates = false, email_store_updates = false/i);
});

test('transactional order email preference cannot be disabled', () => {
  assert.match(migration, /email_order_updates boolean not null default true/i);
  assert.match(migration, /email_order_updates = true/i);
  assert.doesNotMatch(
    readFileSync(new URL('../components/notifications/NotificationCenter.tsx', import.meta.url), 'utf8'),
    /checked=\{preferences\.email_order_updates\}[^>]*onChange/i,
  );
});

test('unsubscribe and Resend one-click delivery use safe HTTP semantics', () => {
  assert.match(unsubscribe, /request\.method !== 'POST'/i);
  assert.match(worker, /List-Unsubscribe-Post/i);
  assert.match(worker, /List-Unsubscribe/i);
  assert.match(migration, /email_delivery_events[\s\S]*provider_message_id/i);
});

test('notification rollback flag gates navigation, dashboard and pages', () => {
  assert.match(adminNav, /isNotificationsEnabled/);
  assert.match(adminPage, /isNotificationsEnabled/);
  assert.match(accountNotificationsPage, /!isNotificationsEnabled\(\)\) redirect\('\/account'\)/);
  assert.match(adminNotificationsPage, /!isNotificationsEnabled\(\)\) redirect\('\/admin'\)/);
  assert.match(accountNotificationsPage, /initialHasMore/);
  assert.match(adminNotificationsPage, /initialHasMore/);
});

test('header exposes an authenticated notification bell', () => {
  assert.match(header, /NotificationBell/);
  assert.match(header, /isLoggedIn/);
  assert.match(header, /userId=\{user\?\.id/);
  assert.doesNotMatch(notificationBell, /auth\.getClaims\(\)/);
});

test('client notification flag is statically inlined by Next.js', () => {
  assert.match(notificationBell, /process\.env\.NEXT_PUBLIC_ENABLE_NOTIFICATIONS\s*===\s*'true'/);
  assert.doesNotMatch(notificationBell, /isNotificationsEnabled/);
});

test('email worker rechecks queue eligibility and handles RPC failures', () => {
  assert.match(migration, /status = 'cancelled'/i);
  assert.match(migration, /email_event_updates|email_store_updates/);
  assert.match(worker, /complete_notification_email[\s\S]*?completionError|completionError[\s\S]*?complete_notification_email/i);
  assert.match(worker, /fail_notification_email[\s\S]*?error/i);
});

test('Resend webhook bounds and validates the request body before verification', () => {
  assert.match(webhook, /MAX_WEBHOOK_BODY_BYTES/);
  assert.match(webhook, /content-length/i);
  assert.match(webhook, /application\/json/i);
  assert.match(webhook, /getReader\(\)/i);
});

test('unsubscribe HTML escapes the signed email and action URL', () => {
  assert.match(unsubscribe, /function escapeHtml/);
  assert.match(unsubscribe, /escapeHtml\(email\)/);
  assert.match(unsubscribe, /escapeHtml\(action\)/);
});

test('notification timestamps are stable across server and browser timezones', () => {
  assert.match(notificationCenter, /timeZone: 'Asia\/Ho_Chi_Minh'/);
  assert.match(notificationBell, /timeZone: 'Asia\/Ho_Chi_Minh'/);
});

test('notification history is bounded and supports loading the next page', () => {
  assert.match(accountNotificationsPage, /range\(0, 49\)/);
  assert.match(adminNotificationsPage, /range\(0, 49\)/);
  assert.match(accountNotificationsPage, /select\('\*', \{ count: 'exact' \}\)/);
  assert.match(adminNotificationsPage, /select\('\*', \{ count: 'exact' \}\)/);
  assert.match(notificationCenter, /const loadMore = async/);
  assert.match(notificationCenter, /range\(from, from \+ 49\)/);
  assert.match(notificationCenter, /Load more notifications/);
});

test('notification types match the persisted outbox and suppression states', () => {
  assert.match(databaseTypes, /status: 'pending' \| 'processing' \| 'accepted' \| 'delivered' \| 'failed' \| 'cancelled'/);
  assert.match(databaseTypes, /reason: 'bounced' \| 'complained'/);
  assert.match(worker, /failureData !== true/);
});
