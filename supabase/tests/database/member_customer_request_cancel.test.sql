begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

select has_function(
  'public', 'cancel_owned_customer_request', array['uuid'],
  'member customer request cancellation function exists'
);
select ok(
  has_function_privilege('authenticated', 'public.cancel_owned_customer_request(uuid)', 'EXECUTE'),
  'authenticated members can execute customer request cancellation'
);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  (
    '00000000-0000-0000-0000-000000000000', '41111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated', 'request-cancel-member@beanbus.test', '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000', '42222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated', 'request-cancel-other@beanbus.test', '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000', '43333333-3333-4333-8333-333333333333',
    'authenticated', 'authenticated', 'request-cancel-admin@beanbus.test', '{}'::jsonb, now(), now()
  );

set local role authenticated;
set local request.jwt.claim.sub = '41111111-1111-4111-8111-111111111111';
create temporary table member_request as
select * from public.create_customer_request(
  '41111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'contact', 'Thành Viên Hủy', '+84987654321',
  null, null, null, null, 'Tôi cần hủy yêu cầu liên hệ này.', true
);

select is(
  (select request_status from public.cancel_owned_customer_request((select request_id from member_request))),
  'cancelled',
  'owner can cancel a pending customer request'
);
select is(
  (select status from public.customer_requests where id = (select request_id from member_request)),
  'cancelled',
  'customer request cancellation updates status'
);
select is(
  (select actor_user_id from public.customer_request_status_history where customer_request_id = (select request_id from member_request)),
  '41111111-1111-4111-8111-111111111111'::uuid,
  'customer cancellation audit records the member actor'
);
select is(
  (select count(*)::integer from public.customer_request_status_history where customer_request_id = (select request_id from member_request)),
  1,
  'customer cancellation writes one audit row'
);
select is(
  (select request_status from public.cancel_owned_customer_request((select request_id from member_request))),
  'cancelled',
  'customer cancellation retry is idempotent'
);
select is(
  (select count(*)::integer from public.customer_request_status_history where customer_request_id = (select request_id from member_request)),
  1,
  'customer cancellation retry does not duplicate audit'
);

reset role;
update public.profiles set role = 'admin'
where id = '43333333-3333-4333-8333-333333333333';

set local role authenticated;
set local request.jwt.claim.sub = '41111111-1111-4111-8111-111111111111';
create temporary table terminal_request as
select * from public.create_customer_request(
  '42222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'contact', 'Thành Viên Hoàn Tất', '+84987654322',
  null, null, null, null, 'Tôi cần kiểm tra trạng thái yêu cầu này.', true
);

set local request.jwt.claim.sub = '43333333-3333-4333-8333-333333333333';
select * from public.update_customer_request_status((select request_id from terminal_request), 'in_progress');
select * from public.update_customer_request_status((select request_id from terminal_request), 'resolved');

set local request.jwt.claim.sub = '41111111-1111-4111-8111-111111111111';
select throws_like(
  $$select * from public.cancel_owned_customer_request((select request_id from terminal_request))$$,
  '%REQUEST_CANNOT_CANCEL%',
  'resolved customer request cannot be cancelled'
);

set local request.jwt.claim.sub = '42222222-2222-4222-8222-222222222222';
select throws_like(
  $$select * from public.cancel_owned_customer_request((select request_id from member_request))$$,
  '%REQUEST_NOT_FOUND%',
  'another member cannot cancel an owned customer request'
);

reset role;
select ok(
  not has_column_privilege('authenticated', 'public.customer_requests', 'status', 'UPDATE'),
  'authenticated clients have no direct customer request status update privilege'
);

select * from finish();
rollback;
