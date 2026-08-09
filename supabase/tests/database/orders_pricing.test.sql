begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

select has_table('public', 'vouchers', 'vouchers table exists');
select has_table('public', 'orders', 'orders table exists');
select has_table('public', 'order_items', 'order items table exists');
select has_table('public', 'order_item_options', 'order item options table exists');

set local role anon;
create temporary table created_order as
select * from public.create_server_priced_order(
  '55555555-5555-4555-8555-555555555555',
  'Khách Beanbus',
  '+84912345678',
  'pickup',
  now() + interval '1 hour',
  null,
  null,
  'cod',
  'BEANBUS10',
  '[{"productId":"cd-1","quantity":2,"optionIds":["size-l"]}]'::jsonb
);

select is((select subtotal_vnd from created_order), 90000, 'subtotal uses canonical product and option prices');
select is((select discount_vnd from created_order), 9000, 'voucher discount is server-calculated');
select is((select total_vnd from created_order), 81000, 'total is subtotal minus bounded discount');

create temporary table retried_order as
select * from public.create_server_priced_order(
  '55555555-5555-4555-8555-555555555555',
  'Khách Beanbus',
  '+84912345678',
  'pickup',
  now() + interval '1 hour',
  null,
  null,
  'cod',
  'BEANBUS10',
  '[{"productId":"cd-1","quantity":2,"optionIds":["size-l"]}]'::jsonb
);

reset role;
select is((select count(*)::integer from public.orders), 1, 'repeated idempotency key creates one order');
select is((select usage_count from public.vouchers where code = 'BEANBUS10'), 1, 'idempotent retry consumes voucher once');
select is((select unit_price_vnd from public.order_items), 45000, 'order item stores the canonical unit-price snapshot');

set local role anon;
select throws_like(
  $$select * from public.create_server_priced_order(
    '66666666-6666-4666-8666-666666666666', 'Khách Beanbus', '+84912345678',
    'pickup', now() + interval '1 hour', null, null, 'cod', null,
    '[{"productId":"cd-1","quantity":1,"optionIds":["not-real"]}]'::jsonb
  )$$,
  '%INVALID_OPTION%',
  'unknown options are rejected'
);

reset role;
update public.products set is_available = false where id = 'cd-1';
set local role anon;
select throws_like(
  $$select * from public.create_server_priced_order(
    '77777777-7777-4777-8777-777777777777', 'Khách Beanbus', '+84912345678',
    'pickup', now() + interval '1 hour', null, null, 'cod', null,
    '[{"productId":"cd-1","quantity":1,"optionIds":[]}]'::jsonb
  )$$,
  '%PRODUCT_UNAVAILABLE%',
  'unavailable products are rejected'
);
select is((select count(*)::integer from public.orders), 0, 'anonymous visitors cannot read orders');

select * from finish();
rollback;
