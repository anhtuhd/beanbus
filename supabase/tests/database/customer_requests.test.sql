begin;

create extension if not exists pgtap with schema extensions;
select plan(17);

select has_table('public', 'customer_requests', 'customer requests table exists');
select has_function(
  'public', 'create_customer_request',
  array['uuid', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'boolean'],
  'customer request creation function exists'
);

set local role anon;
create temporary table created_contact as
select * from public.create_customer_request(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'contact', 'Khách Liên Hệ', '+84912345678',
  'guest@example.com', null, null, null, 'Tôi cần tư vấn sản phẩm cà phê.', true
);
select is((select request_status from created_contact), 'pending', 'contact request starts pending');
select is((select count(*)::integer from public.customer_requests), 0, 'anonymous visitor cannot read customer requests');

create temporary table retried_contact as
select * from public.create_customer_request(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'contact', 'Khách Liên Hệ', '+84912345678',
  'guest@example.com', null, null, null, 'Tôi cần tư vấn sản phẩm cà phê.', true
);
select is((select request_id from retried_contact), (select request_id from created_contact), 'retry returns the same request');

select throws_like(
  $$select * from public.create_customer_request(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'contact', 'Khách Liên Hệ', '+84912345678',
    null, null, null, null, 'Tôi cần tư vấn sản phẩm cà phê.', false
  )$$,
  '%CONSENT_REQUIRED%',
  'missing consent is rejected'
);
select throws_like(
  $$select * from public.create_customer_request(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'rsvp', 'Khách Sự Kiện', '+84923456789',
    null, 'bean-1', null, null, null, true
  )$$,
  '%INVALID_EVENT%',
  'RSVP rejects an invalid event reference'
);

select is(
  (select created_request_type from public.create_customer_request(
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'rsvp', 'Khách Sự Kiện', '+84923456789',
    null, 'event-1', null, null, null, true
  )),
  'rsvp',
  'valid RSVP is stored'
);
select is(
  (select created_request_type from public.create_customer_request(
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'b2b_quote', 'Khách Doanh Nghiệp', '+84934567890',
    null, 'bean-2', 'Quán Cà Phê', '30_100', null, true
  )),
  'b2b_quote',
  'valid B2B quote is stored'
);

create temporary table rate_one as select * from public.create_customer_request(
  'f0000000-0000-4000-8000-000000000000', 'contact', 'Khách Rate', '+84945678901',
  null, null, null, null, 'Yêu cầu liên hệ thứ nhất.', true
);
create temporary table rate_two as select * from public.create_customer_request(
  'f1111111-1111-4111-8111-111111111111', 'contact', 'Khách Rate', '+84945678901',
  null, null, null, null, 'Yêu cầu liên hệ thứ hai.', true
);
create temporary table rate_three as select * from public.create_customer_request(
  'f2222222-2222-4222-8222-222222222222', 'contact', 'Khách Rate', '+84945678901',
  null, null, null, null, 'Yêu cầu liên hệ thứ ba.', true
);
select throws_like(
  $$select * from public.create_customer_request(
    'f3333333-3333-4333-8333-333333333333', 'contact', 'Khách Rate', '+84945678901',
    null, null, null, null, 'Yêu cầu liên hệ thứ tư.', true
  )$$,
  '%RATE_LIMITED%',
  'fourth same-type request in one hour is rate limited'
);

reset role;
select is((select count(*)::integer from public.customer_requests), 6, 'valid requests are persisted exactly once');
select is(
  (select count(*)::integer from public.customer_requests where notification_status = 'not_configured'),
  6,
  'notification remains unconfigured for every request'
);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  (
    '00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated', 'request-member@beanbus.test', '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated', 'request-admin@beanbus.test', '{}'::jsonb, now(), now()
  );

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
create temporary table member_request as select * from public.create_customer_request(
  '99999999-9999-4999-8999-999999999999', 'contact', 'Thành Viên', '+84956789012',
  null, null, null, null, 'Tôi cần Beanbus hỗ trợ thêm.', true
);
select is((select count(*)::integer from public.customer_requests), 1, 'member reads only their request');
update public.customer_requests set status = 'resolved' where id = (select request_id from member_request);

reset role;
select is(
  (select status from public.customer_requests where id = (select request_id from member_request)),
  'pending',
  'member cannot update request status'
);

set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select is((select count(*)::integer from public.customer_requests), 0, 'member cannot read other requests');

reset role;
update public.profiles set role = 'admin' where id = '22222222-2222-4222-8222-222222222222';
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select is((select count(*)::integer from public.customer_requests), 7, 'admin reads all customer requests');
update public.customer_requests set status = 'in_progress' where id = (select request_id from created_contact);

reset role;
select is(
  (select status from public.customer_requests where id = (select request_id from created_contact)),
  'in_progress',
  'admin updates request status'
);

select * from finish();
rollback;
