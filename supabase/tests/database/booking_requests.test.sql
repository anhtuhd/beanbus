begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

select has_table('public', 'booking_requests', 'booking requests table exists');
select has_function(
  'public', 'create_booking_request',
  array['uuid', 'text', 'text', 'timestamp with time zone', 'integer', 'text', 'text', 'boolean'],
  'booking creation function exists'
);

set local role anon;
create temporary table created_booking as
select * from public.create_booking_request(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Khách Đặt Bàn', '+84912345678',
  now() + interval '1 day', 4, 'indoor', 'Gần ổ cắm', true
);
reset role;
grant select on created_booking to authenticated;
set local role anon;
select is((select booking_status from created_booking), 'pending', 'new booking remains pending');
select throws_like(
  $$select count(*)::integer from public.booking_requests$$,
  '%permission denied%',
  'anonymous visitor cannot read booking rows'
);

create temporary table retried_booking as
select * from public.create_booking_request(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Khách Đặt Bàn', '+84912345678',
  now() + interval '1 day', 4, 'indoor', 'Gần ổ cắm', true
);
select is((select booking_id from retried_booking), (select booking_id from created_booking), 'idempotent retry returns the same booking');

select throws_like(
  $$select * from public.create_booking_request(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Khách Đặt Bàn', '+84912345678',
    now() + interval '10 minutes', 4, 'indoor', null, true
  )$$,
  '%INVALID_RESERVATION_TIME%',
  'too-soon reservation is rejected'
);
select throws_like(
  $$select * from public.create_booking_request(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Khách Đặt Bàn', '+84912345678',
    now() + interval '1 day', 4, 'indoor', null, false
  )$$,
  '%CONSENT_REQUIRED%',
  'missing contact consent is rejected'
);

reset role;
select is((select count(*)::integer from public.booking_requests), 1, 'idempotent retry stores one booking');
select is((select notification_status from public.booking_requests), 'not_configured', 'notification remains honest until configured');

insert into auth.users (
  instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated', 'booking-member@beanbus.test', '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated', 'booking-admin@beanbus.test', '{}'::jsonb, now(), now()
  );

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
create temporary table member_booking as
select * from public.create_booking_request(
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Thành Viên', '+84987654321',
  now() + interval '2 days', 2, 'balcony', null, true
);
select is((select count(*)::integer from public.booking_requests), 1, 'member reads only their booking');

select throws_like(
  $$update public.booking_requests set status = 'confirmed'
    where id = (select booking_id from member_booking)$$,
  '%permission denied%',
  'member cannot update booking status directly'
);
reset role;

set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select is((select count(*)::integer from public.booking_requests), 0, 'member cannot read another member or guest booking');

reset role;
update public.profiles set role = 'admin'
where id = '22222222-2222-4222-8222-222222222222';

set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select is((select count(*)::integer from public.booking_requests), 2, 'admin reads all bookings');
select throws_like(
  $$update public.booking_requests set status = 'confirmed'
    where id = (select booking_id from created_booking)$$,
  '%permission denied%',
  'admin cannot update booking status directly'
);

reset role;

select * from finish();
rollback;
