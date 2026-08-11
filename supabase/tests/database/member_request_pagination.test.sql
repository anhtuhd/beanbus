begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

select has_function(
  'public', 'get_member_requests',
  array['uuid', 'integer', 'integer'],
  'member request page function exists'
);
select has_function(
  'public', 'get_member_request_count',
  array['uuid'],
  'member request count function exists'
);
select has_index('public', 'booking_requests', 'booking_requests_user_created_idx', 'booking request pagination index exists');
select has_index('public', 'customer_requests', 'customer_requests_user_created_idx', 'customer request pagination index exists');

set local role anon;
select throws_like(
  $$select * from public.get_member_requests('11111111-1111-4111-8111-111111111111', 1, 20)$$,
  '%permission denied%',
  'anonymous visitors cannot execute member request pagination'
);
reset role;

insert into auth.users (
  instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated', 'request-page-member@beanbus.test', '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated', 'request-page-other@beanbus.test', '{}'::jsonb, now(), now()
  );

insert into public.booking_requests (
  idempotency_key, user_id, customer_name, customer_phone, reservation_at,
  guest_count, seating_area, consent_to_contact, created_at
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'Thành viên', '+84912345678', now() + interval '1 day', 2, 'indoor', true, now() - interval '2 minutes'
);

insert into public.customer_requests (
  idempotency_key, user_id, request_type, contact_name, contact_phone,
  message, consent_to_contact, created_at
)
values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '11111111-1111-4111-8111-111111111111',
  'contact', 'Thành viên', '+84923456789', 'Tôi cần Beanbus hỗ trợ.', true, now() - interval '1 minute'
);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select is(
  public.get_member_request_count('11111111-1111-4111-8111-111111111111'),
  2::bigint,
  'member receives only their total request count'
);
select is(
  (select count(*)::integer from public.get_member_requests('11111111-1111-4111-8111-111111111111', 1, 1)),
  1,
  'request page is limited by page size'
);
select is(
  (select total_count from public.get_member_requests('11111111-1111-4111-8111-111111111111', 1, 1)),
  2::bigint,
  'request page includes the complete total count'
);
select is(
  (select kind from public.get_member_requests('11111111-1111-4111-8111-111111111111', 2, 1)),
  'booking',
  'request pages use stable created-at and id ordering'
);
select throws_like(
  $$select public.get_member_request_count('22222222-2222-4222-8222-222222222222')$$,
  '%REQUESTS_FORBIDDEN%',
  'member cannot request another member count'
);
select throws_like(
  $$select * from public.get_member_requests('11111111-1111-4111-8111-111111111111', 0, 20)$$,
  '%INVALID_REQUEST_PAGE%',
  'invalid request page is rejected'
);
select throws_like(
  $$select * from public.get_member_requests('11111111-1111-4111-8111-111111111111', 1, 51)$$,
  '%INVALID_REQUEST_PAGE_SIZE%',
  'oversized request page is rejected'
);

reset role;
select * from finish();
rollback;
