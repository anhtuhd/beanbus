begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

select has_function(
  'public', 'cancel_owned_booking_request', array['uuid'],
  'member booking cancellation function exists'
);
select ok(
  has_function_privilege('authenticated', 'public.cancel_owned_booking_request(uuid)', 'EXECUTE'),
  'authenticated members can execute the cancellation function'
);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  (
    '00000000-0000-0000-0000-000000000000', '31111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated', 'cancel-member@beanbus.test', '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000', '32222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated', 'cancel-other@beanbus.test', '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333',
    'authenticated', 'authenticated', 'cancel-admin@beanbus.test', '{}'::jsonb, now(), now()
  );

set local role authenticated;
set local request.jwt.claim.sub = '31111111-1111-4111-8111-111111111111';
create temporary table member_booking as
select * from public.create_booking_request(
  '31111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Thành Viên Hủy', '+84987654321',
  now() + interval '2 days', 2, 'balcony', null, true
);

select is(
  (select booking_status from public.cancel_owned_booking_request((select booking_id from member_booking))),
  'cancelled',
  'owner can cancel a pending booking'
);
select is(
  (select status from public.booking_requests where id = (select booking_id from member_booking)),
  'cancelled',
  'cancellation updates the booking status'
);
select is(
  (select actor_user_id from public.booking_request_status_history where booking_request_id = (select booking_id from member_booking)),
  '31111111-1111-4111-8111-111111111111'::uuid,
  'cancellation audit records the member actor'
);
select is(
  (select count(*)::integer from public.booking_request_status_history where booking_request_id = (select booking_id from member_booking)),
  1,
  'first cancellation writes one audit row'
);
select is(
  (select booking_status from public.cancel_owned_booking_request((select booking_id from member_booking))),
  'cancelled',
  'cancellation retry is idempotent'
);
select is(
  (select count(*)::integer from public.booking_request_status_history where booking_request_id = (select booking_id from member_booking)),
  1,
  'idempotent cancellation does not duplicate the audit row'
);

reset role;
update public.profiles set role = 'admin'
where id = '33333333-3333-4333-8333-333333333333';

set local role authenticated;
set local request.jwt.claim.sub = '31111111-1111-4111-8111-111111111111';
create temporary table terminal_booking as
select * from public.create_booking_request(
  '32222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Thành Viên Hoàn Tất', '+84987654322',
  now() + interval '2 days', 2, 'indoor', null, true
);

set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
select * from public.update_booking_request_status((select booking_id from terminal_booking), 'confirmed');
select * from public.update_booking_request_status((select booking_id from terminal_booking), 'completed');

set local request.jwt.claim.sub = '31111111-1111-4111-8111-111111111111';
select throws_like(
  $$select * from public.cancel_owned_booking_request((select booking_id from terminal_booking))$$,
  '%BOOKING_CANNOT_CANCEL%',
  'completed booking cannot be cancelled'
);

set local request.jwt.claim.sub = '32222222-2222-4222-8222-222222222222';
select throws_like(
  $$select * from public.cancel_owned_booking_request((select booking_id from member_booking))$$,
  '%BOOKING_NOT_FOUND%',
  'another member cannot cancel an owned booking'
);

reset role;
select ok(
  not has_column_privilege('authenticated', 'public.booking_requests', 'status', 'UPDATE'),
  'authenticated clients have no direct booking status update privilege'
);

select * from finish();
rollback;
