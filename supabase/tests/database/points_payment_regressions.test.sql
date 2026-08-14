begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

select has_function(
  'public', 'refund_order_settlement', array['uuid'],
  'points settlement refund function exists'
);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '12121212-1212-4121-8121-121212121212', 'authenticated', 'authenticated', 'points-member@beanbus.test', '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '34343434-3434-4343-8343-343434343434', 'authenticated', 'authenticated', 'points-admin@beanbus.test', '{}'::jsonb, now(), now());

update public.profiles set role = 'admin' where id = '34343434-3434-4343-8343-343434343434';
update public.loyalty_policy set enabled = false;

insert into public.orders (
  id, idempotency_key, user_id, customer_name, customer_phone, fulfillment, pickup_at,
  subtotal_vnd, discount_vnd, total_vnd, points_applied, cash_due_vnd,
  payment_method, payment_status, status
) values
  (
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000001', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000011',
    '12121212-1212-4121-8121-121212121212', 'COD partial points', '+84912345678', 'pickup', now() + interval '1 hour',
    100, 0, 100, 50, 50, 'cod', 'pending', 'completed'
  ),
  (
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000002', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000012',
    '12121212-1212-4121-8121-121212121212', 'Refunded order', '+84912345678', 'pickup', now() + interval '1 hour',
    100, 0, 100, 0, 100, 'sepay_qr', 'refunded', 'confirmed'
  ),
  (
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000003', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000013',
    '12121212-1212-4121-8121-121212121212', 'COD completion', '+84912345678', 'pickup', now() + interval '1 hour',
    100, 0, 100, 0, 100, 'cod', 'pending', 'ready'
  ),
  (
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000004', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000014',
    '12121212-1212-4121-8121-121212121212', 'Legacy retry', '+84912345678', 'pickup', now() + interval '1 hour',
    100, 0, 100, 0, 100, 'cod', 'pending', 'pending'
  );

set local role authenticated;
set local request.jwt.claim.sub = '34343434-3434-4343-8343-343434343434';

create temporary table cod_refund as
select * from public.refund_order_settlement('aaaaaaaa-bbbb-4ccc-8ddd-000000000001');

select is((select cash_refunded_vnd from cod_refund), 50, 'completed COD refund records the cash remainder');
select is((select points_restored from cod_refund), 50, 'completed COD refund restores applied points');
select is(
  (select payment_status::text from public.orders where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001'),
  'refunded',
  'completed COD refund finalizes payment settlement'
);
select is(
  (select status::text from public.orders where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001'),
  'cancelled',
  'completed COD refund closes the order'
);
select is(
  (select coalesce(sum(points), 0)::integer from public.loyalty_ledger
   where order_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001' and source_type = 'order_payment_refund'),
  50,
  'completed COD refund credits points exactly once'
);
select is(
  (select count(*)::integer from public.order_refund_history where order_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001' and payment_id is null),
  1,
  'completed COD refund has one manual cash-refund audit record'
);
select throws_like(
  $$select * from public.update_order_status('aaaaaaaa-bbbb-4ccc-8ddd-000000000002', 'preparing')$$,
  '%ORDER_SETTLEMENT_FINALIZED%',
  'refunded order cannot advance through fulfillment'
);
select is(
  (select updated_order_status::text from public.update_order_status('aaaaaaaa-bbbb-4ccc-8ddd-000000000003', 'completed')),
  'completed',
  'admin can complete a COD order'
);
select is(
  (select payment_status::text from public.orders where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000003'),
  'paid',
  'completing a COD order settles its payment'
);

set local request.jwt.claim.sub = '12121212-1212-4121-8121-121212121212';
select throws_like(
  $$select * from public.create_server_priced_order_v2(
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000014', 'Different retry', '+84912345678',
    'pickup', now() + interval '1 hour', null, null, 'cod', null, '[]'::jsonb, 0
  )$$,
  '%IDEMPOTENCY_CONFLICT%',
  'a legacy idempotency key without a fingerprint cannot adopt a different request'
);

set local request.jwt.claim.sub = '34343434-3434-4343-8343-343434343434';
select matches(
  (select prosrc from pg_proc where oid = 'public.redeem_loyalty_reward(text, uuid)'::regprocedure),
  'loyalty_wallet_lock_key',
  'reward redemption serializes with every other wallet debit'
);
select ok(
  position('from public.orders where id = v_order_id for update' in (
    select pg_get_functiondef('public.process_sepay_webhook(bigint, text, timestamp with time zone, text, text, text, integer, text, jsonb)'::regprocedure)
  )) < position('from public.payments where id = v_payment_id for update' in (
    select pg_get_functiondef('public.process_sepay_webhook(bigint, text, timestamp with time zone, text, text, text, integer, text, jsonb)'::regprocedure)
  )),
  'webhook locks the order before its payment'
);
select ok(
  position('from public.orders where id = v_order_id for update' in (
    select pg_get_functiondef('public.process_sepay_reconciliation(text, text, timestamp with time zone, text, text, text, integer, text, text, jsonb)'::regprocedure)
  )) < position('from public.payments where id = v_payment_id for update' in (
    select pg_get_functiondef('public.process_sepay_reconciliation(text, text, timestamp with time zone, text, text, text, integer, text, text, jsonb)'::regprocedure)
  )),
  'reconciliation locks the order before its payment'
);

reset role;
select * from finish();
rollback;
