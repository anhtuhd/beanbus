begin;

create extension if not exists pgtap with schema extensions;
select plan(21);

select has_table('public', 'voucher_reservations', 'voucher reservation ledger exists');
select has_function(
  'public', 'sync_voucher_reservation', array[]::text[],
  'voucher reservation trigger function exists'
);
select has_function(
  'public', 'expire_pending_sepay_payments', array[]::text[],
  'pending SePay cleanup function exists'
);
select col_is_pk('public', 'voucher_reservations', 'order_id', 'one reservation is allowed per order');

set local role authenticated;
select throws_like(
  $$select * from public.voucher_reservations$$,
  '%permission denied%',
  'members cannot read the service-only voucher reservation ledger'
);
reset role;

set local role anon;
create temporary table cancelled_order as
select * from public.create_server_priced_order(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Voucher Cancel', '+84912345678',
  'pickup', now() + interval '1 hour', null, null, 'cod', 'BEANBUS10',
  '[{"productId":"cd-1","quantity":1,"optionIds":[]}]'::jsonb
);
reset role;

select is(
  (select usage_count from public.vouchers where code = 'BEANBUS10'),
  1,
  'creating an order reserves one voucher quota'
);
select is(
  (select status from public.voucher_reservations where order_id = (select order_id from cancelled_order)),
  'reserved',
  'new voucher-backed order starts reserved'
);

update public.orders
set status = 'cancelled'
where id = (select order_id from cancelled_order);

select is(
  (select status from public.voucher_reservations where order_id = (select order_id from cancelled_order)),
  'released',
  'cancelled order releases the voucher reservation'
);
select is(
  (select usage_count from public.vouchers where code = 'BEANBUS10'),
  0,
  'released reservation returns the voucher quota'
);

set local role anon;
create temporary table completed_order as
select * from public.create_server_priced_order(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Voucher Complete', '+84912345679',
  'pickup', now() + interval '1 hour', null, null, 'cod', 'BEANBUS10',
  '[{"productId":"cd-1","quantity":1,"optionIds":[]}]'::jsonb
);
reset role;
update public.orders
set status = 'completed'
where id = (select order_id from completed_order);

select is(
  (select status from public.voucher_reservations where order_id = (select order_id from completed_order)),
  'consumed',
  'completed COD order consumes the voucher reservation'
);
select is(
  (select usage_count from public.vouchers where code = 'BEANBUS10'),
  1,
  'consumed reservation remains counted against voucher usage'
);

set local role anon;
create temporary table expiring_order as
select * from public.create_server_priced_order(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Voucher Expiry', '+84912345680',
  'pickup', now() + interval '1 hour', null, null, 'sepay_qr', 'WELCOMEVIP',
  '[{"productId":"cd-1","quantity":2,"optionIds":[]}]'::jsonb
);
create temporary table expiring_receipt as
select * from public.issue_order_receipt('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
reset role;
create temporary table expiring_payment as
select * from public.create_sepay_payment(
  (select order_id from expiring_receipt),
  (select receipt_token from expiring_receipt),
  'MB', '0937936688'
);
update public.payments
set expires_at = now() - interval '1 minute'
where id = (select payment_id from expiring_payment);

select is(
  public.expire_pending_sepay_payments(),
  1,
  'cleanup expires pending SePay payments once'
);
select is(
  (select payment_status::text from public.orders where id = (select order_id from expiring_order)),
  'failed',
  'expired SePay payment moves the order to failed payment state'
);
select is(
  (select status from public.voucher_reservations where order_id = (select order_id from expiring_order)),
  'released',
  'expired SePay payment releases the voucher reservation'
);
select is(
  (select usage_count from public.vouchers where code = 'WELCOMEVIP'),
  0,
  'expired payment returns the reserved voucher quota'
);

set local role anon;
create temporary table abandoned_order as
select * from public.create_server_priced_order(
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Voucher Abandoned', '+84912345681',
  'pickup', now() + interval '1 hour', null, null, 'sepay_qr', 'WELCOMEVIP',
  '[{"productId":"cd-1","quantity":2,"optionIds":[]}]'::jsonb
);
reset role;
update public.orders
set created_at = now() - interval '31 minutes'
where id = (select order_id from abandoned_order);

select is(
  public.expire_pending_sepay_payments(),
  1,
  'cleanup expires an abandoned SePay order without a payment row'
);
select is(
  (select payment_status::text from public.orders where id = (select order_id from abandoned_order)),
  'failed',
  'abandoned SePay order moves to failed payment state'
);
select is(
  (select status from public.voucher_reservations where order_id = (select order_id from abandoned_order)),
  'released',
  'abandoned SePay order releases the voucher reservation'
);

insert into public.vouchers (
  code, discount_type, discount_value, usage_limit, is_active
) values ('LIMITONE', 'fixed', 1000, 1, true);

set local role anon;
create temporary table limited_order as
select * from public.create_server_priced_order(
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Voucher Limit', '+84912345682',
  'pickup', now() + interval '1 hour', null, null, 'cod', 'LIMITONE',
  '[{"productId":"cd-1","quantity":1,"optionIds":[]}]'::jsonb
);
select throws_like(
  $$select * from public.create_server_priced_order(
    'ffffffff-ffff-4fff-8fff-ffffffffffff', 'Voucher Limit 2', '+84912345683',
    'pickup', now() + interval '1 hour', null, null, 'cod', 'LIMITONE',
    '[{"productId":"cd-1","quantity":1,"optionIds":[]}]'::jsonb
  )$$,
  '%INVALID_VOUCHER%',
  'voucher usage limit rejects a second reservation'
);
reset role;
select is(
  (select usage_count from public.vouchers where code = 'LIMITONE'),
  1,
  'usage limit keeps one active reservation'
);
select is(
  (select count(*)::integer from public.voucher_reservations where voucher_code = 'LIMITONE'),
  1,
  'rejected usage-limit attempt creates no reservation'
);

select * from finish();
rollback;
