begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

select has_table('public', 'product_status_history', 'product status history exists');
select has_function(
  'public', 'update_product_status', array['text', 'boolean', 'boolean'],
  'product status RPC exists'
);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  (
    '00000000-0000-0000-0000-000000000000', '55555555-5555-4555-8555-555555555555',
    'authenticated', 'authenticated', 'catalog-operations-member@beanbus.test', '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000', '66666666-6666-4666-8666-666666666666',
    'authenticated', 'authenticated', 'catalog-operations-admin@beanbus.test', '{}'::jsonb, now(), now()
  );

set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';
select throws_like(
  $$select * from public.update_product_status('cd-1', false, false)$$,
  '%ADMIN_REQUIRED%',
  'member cannot update product status'
);

reset role;
update public.profiles set role = 'admin' where id = '66666666-6666-4666-8666-666666666666';
set local role authenticated;
set local request.jwt.claim.sub = '66666666-6666-4666-8666-666666666666';

select is(
  (select updated_is_available from public.update_product_status('cd-1', false, false)),
  false,
  'admin can stop product availability'
);
select is((select is_published from public.products where id = 'cd-1'), false, 'admin can unpublish product');
select is((select count(*)::integer from public.product_status_history), 1, 'status change writes one audit row');
select is(
  (select actor_user_id from public.product_status_history),
  '66666666-6666-4666-8666-666666666666'::uuid,
  'audit records the admin actor'
);
select is(
  (select updated_is_published from public.update_product_status('cd-1', false, false)),
  false,
  'same product state is idempotent'
);
select is((select count(*)::integer from public.product_status_history), 1, 'idempotent retry adds no audit row');

reset role;
select ok(
  not has_table_privilege('authenticated', 'public.products', 'UPDATE'),
  'authenticated clients have no direct product update privilege'
);
select ok(
  not has_table_privilege('authenticated', 'public.products', 'INSERT'),
  'authenticated clients have no direct product insert privilege'
);
select ok(
  not has_table_privilege('authenticated', 'public.products', 'DELETE'),
  'authenticated clients have no direct product delete privilege'
);

select * from finish();
rollback;
