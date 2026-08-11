begin;

create extension if not exists pgtap with schema extensions;
select plan(17);

select has_table('public', 'booking_request_status_history', 'booking status history exists');
select has_table('public', 'customer_request_status_history', 'customer request status history exists');
select has_function('public', 'update_booking_request_status', array['uuid', 'text'], 'booking status RPC exists');
select has_function('public', 'update_customer_request_status', array['uuid', 'text'], 'customer request status RPC exists');

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  (
    '00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated', 'status-member@beanbus.test', '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated', 'status-admin@beanbus.test', '{}'::jsonb, now(), now()
  );

set local role anon;
create temporary table status_booking as select * from public.create_booking_request(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Khách Đặt Bàn', '+84912345678',
  now() + interval '1 day', 2, 'indoor', null, true
);
create temporary table status_request as select * from public.create_customer_request(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'contact', 'Khách Liên Hệ', '+84923456789',
  null, null, null, null, 'Tôi cần Beanbus hỗ trợ thông tin.', true
);

reset role;
select set_config('test.status_booking_id', (select booking_id::text from status_booking), true);
select set_config('test.status_request_id', (select request_id::text from status_request), true);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select throws_like(
  $$select * from public.update_booking_request_status(
    current_setting('test.status_booking_id')::uuid, 'confirmed'
  )$$,
  '%ADMIN_REQUIRED%',
  'member cannot update booking status'
);
select throws_like(
  $$select * from public.update_customer_request_status(
    current_setting('test.status_request_id')::uuid, 'in_progress'
  )$$,
  '%ADMIN_REQUIRED%',
  'member cannot update customer request status'
);

reset role;
update public.profiles set role = 'admin' where id = '22222222-2222-4222-8222-222222222222';
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

select is(
  (select booking_status from public.update_booking_request_status(
    current_setting('test.status_booking_id')::uuid, 'confirmed'
  )),
  'confirmed',
  'admin confirms pending booking'
);
select is((select count(*)::integer from public.booking_request_status_history), 1, 'booking transition writes one audit row');
select is(
  (select actor_user_id from public.booking_request_status_history),
  '22222222-2222-4222-8222-222222222222'::uuid,
  'booking audit records the admin actor'
);

select is(
  (select booking_status from public.update_booking_request_status(
    current_setting('test.status_booking_id')::uuid, 'confirmed'
  )),
  'confirmed',
  'same booking status is idempotent'
);
select is((select count(*)::integer from public.booking_request_status_history), 1, 'idempotent booking retry adds no audit row');
select throws_like(
  $$select * from public.update_booking_request_status(
    current_setting('test.status_booking_id')::uuid, 'rejected'
  )$$,
  '%INVALID_BOOKING_TRANSITION%',
  'invalid booking transition is rejected'
);

select is(
  (select customer_request_status from public.update_customer_request_status(
    current_setting('test.status_request_id')::uuid, 'in_progress'
  )),
  'in_progress',
  'admin starts customer request work'
);
select is(
  (select customer_request_status from public.update_customer_request_status(
    current_setting('test.status_request_id')::uuid, 'resolved'
  )),
  'resolved',
  'admin resolves in-progress customer request'
);
select is((select count(*)::integer from public.customer_request_status_history), 2, 'customer transitions are audited');

reset role;
select ok(
  not has_column_privilege('authenticated', 'public.booking_requests', 'status', 'UPDATE'),
  'authenticated clients have no direct booking status update privilege'
);
select ok(
  not has_column_privilege('authenticated', 'public.customer_requests', 'status', 'UPDATE'),
  'authenticated clients have no direct customer request status update privilege'
);

select * from finish();
rollback;
