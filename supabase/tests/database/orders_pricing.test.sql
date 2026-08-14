begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

select has_table('public', 'vouchers', 'vouchers table exists');
select has_table('public', 'orders', 'orders table exists');
select has_table('public', 'order_items', 'order items table exists');
select has_table('public', 'order_item_options', 'order item options table exists');
select has_table('public', 'catalog_option_groups', 'catalog option groups table exists');
select has_function('public', 'enforce_catalog_option_limits', array[]::text[], 'modifier limits trigger function exists');

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

create temporary table issued_receipt as
select * from public.issue_order_receipt('55555555-5555-4555-8555-555555555555');
select is(
  (select (public.get_order_receipt(order_id, receipt_token) ->> 'totalVnd')::integer from issued_receipt),
  81000,
  'valid receipt capability returns the canonical order snapshot'
);
select is(
  (select public.get_order_receipt(order_id, '99999999-9999-4999-8999-999999999999') from issued_receipt),
  null::jsonb,
  'wrong receipt capability returns no order data'
);

reset role;
select is((select count(*)::integer from public.orders where idempotency_key = '55555555-5555-4555-8555-555555555555'), 1, 'repeated idempotency key creates one order');
select is((select usage_count from public.vouchers where code = 'BEANBUS10'), 1, 'idempotent retry consumes voucher once');
select is((select unit_price_vnd from public.order_items where order_id = (select order_id from created_order)), 45000, 'order item stores the canonical unit-price snapshot');

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
select throws_like(
  $$do $body$
  begin
    perform public.create_server_priced_order(
      '88888888-8888-4888-8888-888888888888', 'Khách Beanbus', '+84912345678',
      'pickup', now() + interval '1 hour', null, null, 'cod', null,
      '[{"productId":"cd-1","quantity":1,"optionIds":[]}]'::jsonb
    );
    set constraints all immediate;
  end;
  $body$;$$,
  '%INVALID_OPTION_SELECTIONS%',
  'required modifier groups are enforced'
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
select throws_like(
  $$select count(*)::integer from public.orders$$,
  '%permission denied%',
  'anonymous visitors cannot read orders'
);

select * from finish();
rollback;
