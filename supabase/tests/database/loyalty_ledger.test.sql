begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '33333333-3333-4333-8333-333333333333',
  'authenticated',
  'authenticated',
  'loyalty-ledger@beanbus.test',
  '{}'::jsonb,
  now(),
  now()
);

update public.loyalty_policy
set enabled = true, earn_bps = 1000, cod_eligible = false;

insert into public.orders (
  id,
  idempotency_key,
  user_id,
  customer_name,
  customer_phone,
  fulfillment,
  pickup_at,
  subtotal_vnd,
  discount_vnd,
  total_vnd,
  payment_method,
  payment_status,
  status
)
values (
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  '33333333-3333-4333-8333-333333333333',
  'Loyalty Test',
  '+84912345678',
  'pickup',
  now() + interval '1 hour',
  100000,
  0,
  100000,
  'cod',
  'paid',
  'completed'
);

select is(
  (select points from public.loyalty_ledger where source_type = 'order_earned'),
  10000,
  'completed paid order earns points while policy is enabled'
);

update public.loyalty_policy
set enabled = false, earn_bps = 0;

update public.orders
set status = 'cancelled'
where id = '44444444-4444-4444-8444-444444444444';

select is(
  (select points from public.loyalty_ledger where source_type = 'order_reversal'),
  -10000,
  'cancellation reverses earned points after policy is disabled'
);

select is(
  (select count(*)::integer from public.loyalty_ledger where order_id = '44444444-4444-4444-8444-444444444444'),
  2,
  'earn and reversal are the only ledger entries for the order'
);

update public.orders
set payment_status = 'refunded'
where id = '44444444-4444-4444-8444-444444444444';

select is(
  (select count(*)::integer from public.loyalty_ledger where order_id = '44444444-4444-4444-8444-444444444444'),
  2,
  'refund after cancellation does not duplicate the reversal'
);

select is(
  (select coalesce(sum(points), 0)::integer from public.loyalty_ledger where user_id = '33333333-3333-4333-8333-333333333333'),
  0,
  'cancelled order leaves no net earned points'
);

select is(
  (select count(*)::integer from public.loyalty_ledger where source_key = 'order:44444444-4444-4444-8444-444444444444:reversed'),
  1,
  'reversal source key is unique and auditable'
);

select * from finish();
rollback;
