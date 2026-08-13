begin;

create extension if not exists pgtap;
select plan(60);

select has_table('public', 'notifications', 'notifications table exists');
select has_table('public', 'notification_preferences', 'notification preferences table exists');
select has_table('public', 'store_announcements', 'store announcements table exists');
select has_table('public', 'email_outbox', 'email outbox table exists');
select has_table('public', 'email_delivery_events', 'email delivery events table exists');
select has_table('public', 'email_suppressions', 'email suppressions table exists');
select has_function('public', 'mark_notification_read', array['uuid'], 'mark notification RPC exists');
select has_function('public', 'mark_all_notifications_read', array[]::text[], 'mark all RPC exists');
select has_function('public', 'update_notification_preferences', array['boolean', 'boolean', 'boolean'], 'preferences RPC exists');
select has_function('public', 'publish_store_announcement', array['text', 'text', 'text', 'text', 'text', 'boolean'], 'announcement RPC exists');
select has_function('public', 'enqueue_role_notifications', array['text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'boolean'], 'set-based role notification RPC exists');
select has_function('public', 'claim_notification_email_batch', array['integer', 'uuid'], 'email claim RPC exists');
select has_function('public', 'record_email_delivery_event', array['text', 'text', 'text', 'timestamptz'], 'delivery event RPC exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.notifications'::regclass),
  'notifications has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.notification_preferences'::regclass),
  'notification preferences has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.store_announcements'::regclass),
  'store announcements has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.email_outbox'::regclass),
  'email outbox has RLS enabled'
);
select ok(
  to_regclass('public.notifications_recipient_created_idx') is not null,
  'recipient notifications index exists'
);
select ok(
  to_regclass('public.notifications_unread_idx') is not null,
  'unread notifications index exists'
);
select ok(
  exists (select 1 from pg_trigger where tgname = 'orders_create_notifications'),
  'new order notification trigger exists'
);
select ok(
  exists (select 1 from pg_trigger where tgname = 'orders_status_create_notifications'),
  'order status notification trigger exists'
);
select ok(
  exists (select 1 from pg_trigger where tgname = 'events_publish_notifications'),
  'event publication notification trigger exists'
);
select ok(
  exists (select 1 from pg_trigger where tgname = 'booking_requests_create_notifications'),
  'new booking request notification trigger exists'
);
select ok(
  exists (select 1 from pg_trigger where tgname = 'customer_requests_create_notifications'),
  'new customer request notification trigger exists'
);
select ok(
  has_table_privilege('authenticated', 'public.notifications', 'SELECT'),
  'authenticated can read notifications through RLS'
);
select ok(
  not has_table_privilege('authenticated', 'public.notifications', 'INSERT'),
  'authenticated cannot insert notifications directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.notification_preferences', 'UPDATE'),
  'authenticated cannot update preferences directly'
);
select ok(
  has_function_privilege('authenticated', 'public.mark_notification_read(uuid)', 'EXECUTE'),
  'authenticated can mark an owned notification read'
);
select ok(
  not has_function_privilege('authenticated', 'public.enqueue_user_notification(uuid,text,text,text,text,text,text,text,text,text,text,boolean)', 'EXECUTE'),
  'authenticated cannot enqueue notifications directly'
);
select ok(
  not has_function_privilege('authenticated', 'public.enqueue_role_notifications(text,text,text,text,text,text,text,text,text,text,text,boolean)', 'EXECUTE'),
  'authenticated cannot fan out role notifications directly'
);
select ok(
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'),
  'notifications are in the realtime publication'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'Members read their notifications'),
  'notification ownership policy exists'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notification_preferences' and policyname = 'Members read their notification preferences'),
  'preference ownership policy exists'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'store_announcements' and policyname = 'Admins read store announcements'),
  'admin announcement read policy exists'
);
select has_function('public', 'complete_notification_email', array['uuid', 'text'], 'email completion RPC exists');
select has_function('public', 'fail_notification_email', array['uuid', 'boolean', 'text'], 'email retry RPC exists');
select has_function('public', 'get_admin_notification_summary', array[]::text[], 'admin notification summary RPC exists');
select has_function('public', 'get_admin_notification_failures', array['integer'], 'admin notification failures RPC exists');

select ok(
  not has_function_privilege('anon', 'public.mark_notification_read(uuid)', 'EXECUTE'),
  'anonymous users cannot mark notifications read'
);
select ok(
  not has_function_privilege('anon', 'public.mark_all_notifications_read()', 'EXECUTE'),
  'anonymous users cannot mark all notifications read'
);
select ok(
  not has_function_privilege('anon', 'public.update_notification_preferences(boolean,boolean,boolean)', 'EXECUTE'),
  'anonymous users cannot update notification preferences'
);
select ok(
  not has_function_privilege('anon', 'public.publish_store_announcement(text,text,text,text,text,boolean)', 'EXECUTE'),
  'anonymous users cannot publish store announcements'
);
select ok(
  not has_function_privilege('anon', 'public.get_admin_notification_summary()', 'EXECUTE'),
  'anonymous users cannot read notification summary'
);
select ok(
  not has_function_privilege('anon', 'public.get_admin_notification_failures(integer)', 'EXECUTE'),
  'anonymous users cannot read notification failures'
);

insert into auth.users (
  instance_id, id, aud, role, email, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '55555555-5555-4555-8555-555555555555',
  'authenticated', 'authenticated', 'notification-member@beanbus.test', now(), now()
);

insert into auth.users (
  instance_id, id, aud, role, email, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'authenticated', 'authenticated', 'notification-admin@beanbus.test', now(), now()
);

update public.profiles
set role = 'admin'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

insert into auth.users (
  instance_id, id, aud, role, email, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'authenticated', 'authenticated', 'notification-admin-two@beanbus.test', now(), now()
);

update public.profiles
set role = 'admin'
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

insert into auth.users (
  instance_id, id, aud, role, email, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '99999999-9999-4999-8999-999999999999',
  'authenticated', 'authenticated', 'notification-member-two@beanbus.test', now(), now()
);

insert into public.notifications (
  id, recipient_user_id, kind, title_vi, title_en, body_vi, body_en,
  href, source_type, source_id, dedupe_key
)
values (
  '66666666-6666-4666-8666-666666666666',
  '55555555-5555-4555-8555-555555555555',
  'order_status_changed', 'Đơn hàng cập nhật', 'Order updated', 'Nội dung', 'Body',
  '/account/orders/1', 'order', 'notification-order', 'notification-order:status'
);

insert into public.email_outbox (
  id, notification_id, recipient_user_id, recipient_email
)
values (
  '77777777-7777-4777-8777-777777777777',
  '66666666-6666-4666-8666-666666666666',
  '55555555-5555-4555-8555-555555555555', 'notification-member@beanbus.test'
);

set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';
select throws_ok(
  $$ select public.update_notification_preferences(false, false, false) $$,
  'ORDER_EMAIL_REQUIRED',
  'transactional order email cannot be disabled'
);
select is(
  (select email_order_updates from public.update_notification_preferences(true, false, false)),
  true,
  'transactional order email remains enabled'
);

set local role service_role;
select is(
  (select count(*) from public.claim_notification_email_batch(50, '88888888-8888-4888-8888-888888888888')),
  1::bigint,
  'worker claims the pending transactional email before completion'
);
select is(
  (select public.record_email_delivery_event('notification-event-before-complete', 'notification-message-before-complete', 'email.bounced', now())),
  true,
  'delivery event is stored before provider message is linked'
);
select is(
  (select public.complete_notification_email('77777777-7777-4777-8777-777777777777', 'notification-message-before-complete')),
  true,
  'completion reconciles a delivery event received first'
);
select is(
  (select status from public.email_outbox where id = '77777777-7777-4777-8777-777777777777'),
  'failed',
  'early bounce keeps the outbox failed'
);
select is(
  (select reason from public.email_suppressions where email = 'notification-member@beanbus.test'),
  'bounced',
  'early bounce creates a hard suppression'
);

insert into public.orders (
  id, order_code, idempotency_key, customer_name, customer_phone, fulfillment, pickup_at,
  subtotal_vnd, discount_vnd, total_vnd, payment_method
)
values (
  '12121212-1212-4121-8121-121212121212', 'DH-260813TEST01', '13131313-1313-4131-8131-131313131313',
  'Priced Order', '+84912345678', 'pickup', now() + interval '1 hour',
  0, 0, 0, 'cod'
);

select is(
  (select count(*) from public.notifications where kind = 'order_created' and source_id = '12121212-1212-4121-8121-121212121212'),
  0::bigint,
  'unpriced order does not notify admins with a zero total'
);

update public.orders
set subtotal_vnd = 40000, discount_vnd = 0, total_vnd = 40000
where id = '12121212-1212-4121-8121-121212121212';

select is(
  (select body_vi from public.notifications
   where recipient_user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
     and source_id = '12121212-1212-4121-8121-121212121212'),
  (select format('Đơn %s từ Priced Order, tổng 40,000đ.', order_code)
   from public.orders
   where id = '12121212-1212-4121-8121-121212121212'),
  'priced order notification uses the canonical total'
);

insert into public.booking_requests (
  idempotency_key, customer_name, customer_phone, reservation_at, guest_count,
  seating_area, consent_to_contact
)
values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Booking Customer', '+84912345678',
  now() + interval '1 hour', 4, 'indoor', true
);

select is(
  (select count(*) from public.notifications
   where kind = 'booking_request_created'
     and recipient_user_id in ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
  ),
  2::bigint,
  'new booking request notifies every admin'
);
select is(
  (select count(*)
   from public.email_outbox as outbox
   join public.notifications as notification on notification.id = outbox.notification_id
   where outbox.recipient_user_id in ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
     and notification.kind = 'booking_request_created'),
  2::bigint,
  'new booking request queues email for every admin'
);

insert into public.customer_requests (
  idempotency_key, request_type, contact_name, contact_phone, contact_email,
  message, consent_to_contact
)
values (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'contact', 'Contact Customer',
  '+84923456789', 'contact-customer@beanbus.test', 'This is a valid customer request.', true
);

select is(
  (select count(*) from public.notifications
   where kind = 'customer_request_created'
     and recipient_user_id in ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')),
  2::bigint,
  'new customer request notifies every admin'
);
select is(
  (select count(*)
   from public.email_outbox as outbox
   join public.notifications as notification on notification.id = outbox.notification_id
   where outbox.recipient_user_id in ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
     and notification.kind = 'customer_request_created'),
  2::bigint,
  'new customer request queues email for every admin'
);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select ok(
  public.publish_store_announcement(
    'Thông báo cửa hàng', 'Store announcement',
    'Nội dung thông báo đủ dài để kiểm tra fan-out theo tập bản ghi.',
    'Announcement body long enough to exercise set based fan out.',
    '/menu', false
  ) is not null,
  'store announcement publishes successfully'
);

set local role service_role;
select is(
  (select count(*) from public.notifications
   where kind = 'store_announcement'
     and source_id = (select id::text from public.store_announcements order by created_at desc limit 1)),
  2::bigint,
  'store announcement fans out to every member'
);
select is(
  (select count(*) from public.email_outbox as outbox
   join public.notifications as notification on notification.id = outbox.notification_id
   where notification.kind = 'store_announcement'
     and notification.source_id = (select id::text from public.store_announcements order by created_at desc limit 1)),
  0::bigint,
  'store announcement without email does not enqueue email'
);

select * from finish();
rollback;
