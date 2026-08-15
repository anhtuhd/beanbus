begin;

create extension if not exists pgtap with schema extensions;
select plan(20);

select has_function('public', 'operator_advance_order', array['uuid'], 'POS advances an order through a server-selected next step');
select has_function(
  'public',
  'operator_create_counter_order',
  array['uuid', 'uuid', 'text', 'text', 'public.order_fulfillment', 'timestamp with time zone', 'text', 'text', 'public.order_payment_method', 'text', 'jsonb', 'integer', 'boolean', 'text', 'boolean', 'text'],
  'POS order RPC requires explicit voucher consent fields'
);
select has_column('public', 'admin_order_creation_audit', 'voucher_consent_confirmed', 'counter voucher consent is auditable');
select has_column('public', 'admin_order_creation_audit', 'voucher_consent_note', 'counter voucher consent reason is auditable');

insert into auth.users (instance_id, id, aud, role, email, phone, phone_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '15151515-1515-4151-8151-151515151515', 'authenticated', 'authenticated', 'pos-staff@beanbus.test', null, null, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '16161616-1616-4161-8161-161616161616', 'authenticated', 'authenticated', 'pos-member@beanbus.test', null, null, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '17171717-1717-4171-8171-171717171717', 'authenticated', 'authenticated', 'pos-blocked@beanbus.test', null, null, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '19191919-1919-4191-8191-191919191919', 'authenticated', 'authenticated', null, '+84912345679', null, '{"full_name":"Pending POS","pending_phone":"+84912345679"}'::jsonb, now(), now());

select is(
  (select pending_phone from public.profiles where id = '19191919-1919-4191-8191-191919191919'),
  '+84912345679'::text,
  'an unconfirmed phone becomes the pending member phone even when metadata matches it'
);
select is(
  (select membership_status::text from public.profiles where id = '19191919-1919-4191-8191-191919191919'),
  'pending',
  'an unconfirmed phone starts with pending membership status'
);

update public.profiles
set role = 'staff'
where id = '15151515-1515-4151-8151-151515151515';

update public.profiles
set phone = '+84912345678'
where id = '16161616-1616-4161-8161-161616161616';

set local role authenticated;
set local request.jwt.claim.sub = '15151515-1515-4151-8151-151515151515';

select is(
  (select count(*)::integer from public.operator_search_members('+84912345678', 10)),
  1,
  'staff can find one member by an exact phone number'
);
select is(
  (select count(*)::integer from public.operator_search_members('%', 10)),
  0,
  'wildcard input cannot enumerate members'
);
select is(
  (select email from public.operator_search_members('+84912345678', 10)),
  null::text,
  'POS search does not disclose the member email'
);
select is(
  (select membership_status::text from public.operator_register_pending_member('19191919-1919-4191-8191-191919191919', '+84912345679', 'Pending POS')),
  'pending',
  'staff can finish registration for the profile created from an unconfirmed phone'
);

reset role;
insert into public.orders (
  id, idempotency_key, customer_name, customer_phone, fulfillment, pickup_at,
  subtotal_vnd, discount_vnd, total_vnd, points_applied, cash_due_vnd,
  payment_method, payment_status, status, created_via, created_by_user_id
) values
  (
    '18181818-1818-4181-8181-181818181818', '19191919-1919-4191-8191-191919191919',
    'Khách tại quầy', '+84912345678', 'pickup', now() + interval '30 minutes',
    0, 0, 0, 0, 0, 'cod', 'pending', 'pending', 'pos', '15151515-1515-4151-8151-151515151515'
  ),
  (
    '20202020-2020-4202-8202-202020202020', '21212121-2121-4212-8212-212121212121',
    'Đơn hỗ trợ', '+84912345678', 'pickup', now() + interval '30 minutes',
    0, 0, 0, 0, 0, 'cod', 'pending', 'pending', 'admin_panel', '15151515-1515-4151-8151-151515151515'
  );

set local role authenticated;
set local request.jwt.claim.sub = '15151515-1515-4151-8151-151515151515';
select is(
  (select updated_order_status::text from public.operator_advance_order('18181818-1818-4181-8181-181818181818')),
  'confirmed',
  'staff can advance a POS order without direct order-table read access'
);
select throws_like(
  $$select * from public.operator_advance_order('20202020-2020-4202-8202-202020202020')$$,
  '%POS_ORDER_REQUIRED%',
  'staff cannot advance an admin-assisted order from POS'
);

set local request.jwt.claim.sub = '16161616-1616-4161-8161-161616161616';
select is(public.issue_member_pass_nonce(repeat('a', 64), now() + interval '5 minutes'), true, 'active member can issue a pass');
select is(public.issue_member_pass_nonce(repeat('b', 64), now() + interval '5 minutes'), true, 'new pass replaces an unused pass');

set local request.jwt.claim.sub = '15151515-1515-4151-8151-151515151515';
select throws_like(
  $$select public.consume_member_pass_nonce(repeat('a', 64))$$,
  '%INVALID_MEMBER_PASS%',
  'replaced member pass cannot be replayed'
);
select is(
  public.consume_member_pass_nonce(repeat('b', 64)),
  '16161616-1616-4161-8161-161616161616'::uuid,
  'latest member pass resolves exactly once'
);

reset role;
insert into public.vouchers (code, discount_type, discount_value, usage_limit, is_active)
values ('POSCLAIM', 'fixed', 1000, 10, true);
set local role authenticated;
set local request.jwt.claim.sub = '16161616-1616-4161-8161-161616161616';
select is(
  (select claimed from public.claim_voucher('POSCLAIM')),
  true,
  'the first member claim reports a new wallet entry'
);
select is(
  (select claimed from public.claim_voucher('POSCLAIM')),
  false,
  'a repeated active claim reports that the voucher is already in the wallet'
);
reset role;
update public.voucher_wallet_entries
set used_order_id = '18181818-1818-4181-8181-181818181818'
where user_id = '16161616-1616-4161-8161-161616161616' and voucher_code = 'POSCLAIM';
set local role authenticated;
set local request.jwt.claim.sub = '16161616-1616-4161-8161-161616161616';
select throws_like(
  $$select * from public.claim_voucher('POSCLAIM')$$,
  '%VOUCHER_ALREADY_USED%',
  'a used voucher cannot be claimed again'
);

reset role;
update public.profiles set membership_status = 'blocked' where id = '17171717-1717-4171-8171-171717171717';
set local role authenticated;
set local request.jwt.claim.sub = '17171717-1717-4171-8171-171717171717';
select throws_like(
  $$select public.issue_member_pass_nonce(repeat('c', 64), now() + interval '5 minutes')$$,
  '%MEMBER_BLOCKED%',
  'blocked member cannot issue a member pass'
);

select * from finish();
rollback;
