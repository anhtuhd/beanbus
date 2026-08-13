begin;

create extension if not exists pgtap with schema extensions;
select plan(61);

select has_table('public', 'guest_notification_sessions', 'guest sessions table exists');
select has_table('public', 'guest_order_access', 'guest order access table exists');
select has_table('public', 'guest_notifications', 'guest notifications table exists');
select has_table('public', 'fcm_installations', 'FCM installations table exists');
select has_table('public', 'fcm_installation_recipients', 'FCM recipient links table exists');
select has_table('public', 'push_outbox', 'push outbox table exists');

select ok((select relrowsecurity from pg_class where oid = 'public.guest_notification_sessions'::regclass), 'guest sessions use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.guest_order_access'::regclass), 'guest order access uses RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.guest_notifications'::regclass), 'guest notifications use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.fcm_installations'::regclass), 'FCM installations use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.fcm_installation_recipients'::regclass), 'FCM recipient links use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.push_outbox'::regclass), 'push outbox uses RLS');

select ok(not has_table_privilege('authenticated', 'public.guest_notifications', 'SELECT'), 'authenticated cannot read private guest notifications directly');
select ok(not has_table_privilege('anon', 'public.fcm_installations', 'SELECT'), 'anonymous users cannot read FIDs');
select ok(not has_table_privilege('authenticated', 'public.push_outbox', 'SELECT'), 'authenticated cannot inspect push outbox');
select ok(has_table_privilege('service_role', 'public.push_outbox', 'SELECT'), 'service role can process push outbox');

select has_function('public', 'link_guest_order_notifications', array['uuid', 'uuid'], 'guest order link RPC exists');
select has_function('public', 'register_fcm_installation', array['text', 'text', 'uuid', 'uuid'], 'FCM registration RPC exists');
select has_function('public', 'unlink_fcm_installation', array['text', 'uuid', 'uuid', 'boolean'], 'FCM unlink RPC exists');
select has_function('public', 'unlink_user_fcm_installations', array['uuid'], 'user unlink RPC exists');
select has_function('public', 'claim_push_notification_batch', array['integer', 'uuid', 'text[]'], 'push claim RPC exists');
select has_function('public', 'complete_push_notification', array['uuid', 'text'], 'push completion RPC exists');
select has_function('public', 'fail_push_notification', array['uuid', 'boolean', 'text'], 'push retry RPC exists');
select has_function('public', 'update_push_notification_preferences', array['boolean', 'boolean', 'boolean', 'boolean'], 'push preferences RPC exists');
select has_function('public', 'mark_guest_notifications_read', array['uuid', 'uuid'], 'guest mark-read RPC exists');

select ok(exists (select 1 from pg_trigger where tgname = 'notifications_enqueue_push'), 'member notifications enqueue push');
select ok(exists (select 1 from pg_trigger where tgname = 'guest_notifications_enqueue_push'), 'guest notifications enqueue push');
select ok(exists (select 1 from pg_trigger where tgname = 'booking_requests_status_notifications'), 'booking status changes notify members');
select ok(exists (select 1 from pg_trigger where tgname = 'customer_requests_status_notifications'), 'request status changes notify members');
select ok(to_regclass('public.guest_notifications_unread_idx') is not null, 'guest unread index exists');

insert into public.orders (
  id, idempotency_key, customer_name, customer_phone, fulfillment, pickup_at,
  subtotal_vnd, discount_vnd, total_vnd, payment_method
) values (
  '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
  'Guest Push', '+84912345678', 'pickup', now() + interval '1 hour',
  35000, 0, 35000, 'cod'
);

select is(
  public.link_guest_order_notifications('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111'),
  true,
  'server can link an issued guest receipt'
);
select is((select count(*) from public.guest_order_access where guest_session_id = '33333333-3333-4333-8333-333333333333'), 1::bigint, 'guest order access is stored once');
select is((select count(*) from public.guest_notifications where guest_session_id = '33333333-3333-4333-8333-333333333333'), 1::bigint, 'linking a guest order creates an initial notification');
select is(
  (select body_vi from public.guest_notifications where guest_session_id = '33333333-3333-4333-8333-333333333333'),
  (select format('Đơn %s đã được tiếp nhận, tổng 35,000đ.', order_code)
   from public.orders
   where id = '11111111-1111-4111-8111-111111111111'),
  'initial guest notification uses the final order total'
);
select is(
  public.link_guest_order_notifications('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111'),
  false,
  'an order cannot be claimed by another guest session'
);

select isnt(
  public.register_fcm_installation(
    'abcdefghijklmnopqrstuvwx', 'vi', null, '33333333-3333-4333-8333-333333333333'
  ),
  null::uuid,
  'guest session can register an FID'
);
select is((select count(*) from public.fcm_installation_recipients where guest_session_id = '33333333-3333-4333-8333-333333333333'), 1::bigint, 'FID is linked to the guest session');
select is(
  public.unlink_fcm_installation('abcdefghijklmnopqrstuvwx', null, '44444444-4444-4444-8444-444444444444', true),
  false,
  'another guest session cannot disable an installation'
);
select is((select active from public.fcm_installations where fid = 'abcdefghijklmnopqrstuvwx'), true, 'rejected unlink keeps the installation active');

update public.orders set status = 'confirmed' where id = '11111111-1111-4111-8111-111111111111';
select is((select count(*) from public.guest_notifications where guest_session_id = '33333333-3333-4333-8333-333333333333'), 2::bigint, 'status change creates one additional guest notification');
select is((select count(*) from public.push_outbox where guest_notification_id in (select id from public.guest_notifications where guest_session_id = '33333333-3333-4333-8333-333333333333')), 1::bigint, 'status notification queues one push');

update public.orders set payment_status = 'paid' where id = '11111111-1111-4111-8111-111111111111';
select is((select count(*) from public.guest_notifications where guest_session_id = '33333333-3333-4333-8333-333333333333'), 3::bigint, 'payment change creates an additional guest notification');
select is((select count(*) from public.push_outbox where guest_notification_id in (select id from public.guest_notifications where guest_session_id = '33333333-3333-4333-8333-333333333333')), 2::bigint, 'payment notification queues a second push');

update public.orders set payment_status = 'paid' where id = '11111111-1111-4111-8111-111111111111';
select is((select count(*) from public.guest_notifications where guest_session_id = '33333333-3333-4333-8333-333333333333'), 3::bigint, 'unchanged payment status is not duplicated');

create temporary table claimed_push as
select * from public.claim_push_notification_batch(50, '55555555-5555-4555-8555-555555555555', null);
select is((select count(*) from claimed_push), 2::bigint, 'worker claims the guest push batch');
select is((select count(*) from public.push_outbox where status = 'processing'), 2::bigint, 'claimed push rows are leased');
select is(
  public.fail_push_notification((select outbox_id from claimed_push order by outbox_id limit 1), false, 'UNREGISTERED'),
  true,
  'UNREGISTERED delivery is recorded'
);
select is((select active from public.fcm_installations where fid = 'abcdefghijklmnopqrstuvwx'), false, 'unregistered FID is disabled');
select is((select count(*) from public.fcm_installation_recipients where guest_session_id = '33333333-3333-4333-8333-333333333333'), 0::bigint, 'unregistered FID recipient links are removed');

do $$
declare
  v_index integer;
begin
  for v_index in 1..4 loop
    perform public.register_fcm_installation(
      'guest-fid-abcdefghijkl-' || v_index::text,
      'vi',
      null,
      '33333333-3333-4333-8333-333333333333'
    );
  end loop;
end;
$$;
select is((select count(*) from public.fcm_installation_recipients where guest_session_id = '33333333-3333-4333-8333-333333333333'), 3::bigint, 'guest session is capped at three installations');

insert into public.orders (
  id, idempotency_key, customer_name, customer_phone, fulfillment, pickup_at,
  subtotal_vnd, discount_vnd, total_vnd, payment_method
)
select
  md5('guest-push-order-' || value::text)::uuid,
  md5('guest-push-key-' || value::text)::uuid,
  'Guest Push ' || value::text,
  '+84912345678', 'pickup', now() + interval '1 hour', 35000, 0, 35000, 'cod'
from generate_series(1, 5) as series(value);

select ok(
  bool_and(public.link_guest_order_notifications(
    '33333333-3333-4333-8333-333333333333',
    md5('guest-push-order-' || value::text)::uuid
  )),
  'five newer guest orders are linked successfully'
)
from generate_series(1, 5) as series(value);
select is((select count(*) from public.guest_order_access where guest_session_id = '33333333-3333-4333-8333-333333333333'), 5::bigint, 'guest session retains at most five orders');
select is(
  (select count(*) from public.guest_notifications where order_id = '11111111-1111-4111-8111-111111111111'),
  0::bigint,
  'notifications for an evicted guest order are removed'
);

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '66666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated', 'push-one@beanbus.test', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '77777777-7777-4777-8777-777777777777', 'authenticated', 'authenticated', 'push-two@beanbus.test', now(), now());

select isnt(
  public.register_fcm_installation(
    'abcdefghijklmnopqrstuvwx', 'vi',
    '66666666-6666-4666-8666-666666666666', '33333333-3333-4333-8333-333333333333'
  ),
  null::uuid,
  'a signed-in user can reuse the guest browser installation'
);
select isnt(
  public.register_fcm_installation(
    'abcdefghijklmnopqrstuvwx', 'vi',
    '77777777-7777-4777-8777-777777777777', null
  ),
  null::uuid,
  'a new account can take the user slot on a shared browser'
);

select ok(
  (select count(*) = 1 from public.fcm_installation_recipients where user_id = '77777777-7777-4777-8777-777777777777')
    and (select count(*) = 0 from public.fcm_installation_recipients where user_id = '66666666-6666-4666-8666-666666666666')
    and (select count(*) = 3 from public.fcm_installation_recipients where guest_session_id = '33333333-3333-4333-8333-333333333333'),
  'account switching removes the previous user but preserves guest delivery'
);

do $$
declare
  v_index integer;
begin
  for v_index in 1..11 loop
    perform public.register_fcm_installation(
      'user-fid-abcdefghijkl-' || lpad(v_index::text, 2, '0'),
      'vi',
      '66666666-6666-4666-8666-666666666666',
      null
    );
  end loop;
end;
$$;
select is((select count(*) from public.fcm_installation_recipients where user_id = '66666666-6666-4666-8666-666666666666'), 10::bigint, 'member is capped at ten installations');
select ok(
  exists (
    select 1
    from public.fcm_installation_recipients as recipient
    join public.fcm_installations as installation on installation.id = recipient.installation_id
    where recipient.user_id = '66666666-6666-4666-8666-666666666666'
      and installation.fid = 'user-fid-abcdefghijkl-11'
  ),
  'member cap retains the newest installation'
);

do $$
begin
  perform public.register_fcm_installation(
    'lease-fid-abcdefghijkl-1', 'vi', null,
    '33333333-3333-4333-8333-333333333333'
  );
end;
$$;
select ok(
  exists (
    select 1
    from public.fcm_installation_recipients as recipient
    join public.fcm_installations as installation on installation.id = recipient.installation_id
    where recipient.guest_session_id = '33333333-3333-4333-8333-333333333333'
      and installation.fid = 'lease-fid-abcdefghijkl-1'
  ),
  'guest cap retains the newest installation'
);

insert into public.guest_notifications (
  guest_session_id, kind, title_vi, title_en, body_vi, body_en, href, order_id, dedupe_key
)
select
  '33333333-3333-4333-8333-333333333333',
  'order_status_changed',
  'Lease test',
  'Lease test',
  'Lease test',
  'Lease test',
  '/order/guest/' || md5('guest-push-order-1')::uuid::text,
  md5('guest-push-order-1')::uuid,
  'lease-test';
update public.push_outbox as outbox
set status = 'processing', attempt_count = 5, locked_until = now() - interval '1 minute'
where outbox.installation_id = (select id from public.fcm_installations where fid = 'lease-fid-abcdefghijkl-1')
  and outbox.guest_notification_id = (select id from public.guest_notifications where dedupe_key = 'lease-test');
create temporary table lease_claims as
select * from public.claim_push_notification_batch(50, '88888888-8888-4888-8888-888888888888', null);
select is((select count(*) from lease_claims where fid = 'lease-fid-abcdefghijkl-1'), 0::bigint, 'expired fifth lease is not claimed again');
select is(
  (select status
   from public.push_outbox
   where guest_notification_id = (select id from public.guest_notifications where dedupe_key = 'lease-test')
     and installation_id = (select id from public.fcm_installations where fid = 'lease-fid-abcdefghijkl-1')),
  'failed',
  'expired fifth lease is terminally failed'
);

select * from finish();
rollback;
