begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

select has_table('public', 'order_status_history', 'order status history exists');
select has_function('public', 'update_order_status', array['uuid', 'order_status'], 'order status RPC exists');
select has_trigger('public', 'orders', 'orders_audit_status_change', 'order status audit trigger exists');

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  (
    '00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated', 'order-status-member@beanbus.test', '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated', 'order-status-admin@beanbus.test', '{}'::jsonb, now(), now()
  );

insert into public.orders (
  id, idempotency_key, customer_name, customer_phone, fulfillment, pickup_at,
  payment_method, payment_status, status
) values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a1111111-1111-4111-8111-111111111111',
    'Khách COD', '+84912345678', 'pickup', now() + interval '1 hour', 'cod', 'pending', 'pending'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b1111111-1111-4111-8111-111111111111',
    'Khách Sepay', '+84923456789', 'pickup', now() + interval '1 hour', 'sepay_qr', 'pending', 'pending'
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'c1111111-1111-4111-8111-111111111111',
    'Khách Đã Trả', '+84934567890', 'pickup', now() + interval '1 hour', 'sepay_qr', 'paid', 'confirmed'
  );

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select throws_like(
  $$select * from public.update_order_status('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'confirmed')$$,
  '%ADMIN_REQUIRED%',
  'member cannot update order status'
);

reset role;
update public.profiles set role = 'admin' where id = '22222222-2222-4222-8222-222222222222';
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

select is(
  (select updated_order_status::text from public.update_order_status(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'confirmed'
  )),
  'confirmed',
  'admin confirms a pending COD order'
);
select is((select count(*)::integer from public.order_status_history), 1, 'admin transition writes one audit row');
select is((select actor_type from public.order_status_history), 'admin', 'admin transition records admin actor type');
select is(
  (select updated_order_status::text from public.update_order_status(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'confirmed'
  )),
  'confirmed',
  'same order status is idempotent'
);
select is((select count(*)::integer from public.order_status_history), 1, 'idempotent order retry adds no audit row');
select throws_like(
  $$select * from public.update_order_status('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ready')$$,
  '%INVALID_ORDER_TRANSITION%',
  'invalid order transition is rejected'
);
select throws_like(
  $$select * from public.update_order_status('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'confirmed')$$,
  '%PAYMENT_REQUIRED%',
  'unpaid Sepay order cannot be confirmed by admin'
);
select throws_like(
  $$select * from public.update_order_status('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'cancelled')$$,
  '%REFUND_REQUIRED%',
  'paid order cannot be cancelled without refund flow'
);

reset role;
set local request.jwt.claim.sub = '';
update public.orders set status = 'preparing'
where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
select is(
  (select actor_type from public.order_status_history
   where order_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  'system',
  'service-style transition records a system actor'
);

select ok(
  not has_column_privilege('authenticated', 'public.orders', 'status', 'UPDATE'),
  'authenticated clients have no direct order status update privilege'
);
select ok(
  not has_column_privilege('authenticated', 'public.orders', 'payment_status', 'UPDATE'),
  'authenticated clients have no direct payment status update privilege'
);

select * from finish();
rollback;
