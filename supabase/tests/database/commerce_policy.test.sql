begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

select has_table('public', 'commerce_policy', 'commerce policy table exists');
select has_table('public', 'commerce_policy_history', 'commerce policy history exists');
select has_table('public', 'order_refund_history', 'order refund history exists');
select has_function('public', 'get_commerce_policy', array[]::text[], 'commerce policy read RPC exists');
select has_function(
  'public', 'update_commerce_policy',
  array['boolean', 'integer', 'text', 'text', 'boolean', 'boolean'],
  'commerce policy update RPC exists'
);
select has_function('public', 'refund_order_payment', array['uuid'], 'refund RPC exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.commerce_policy'::regclass),
  'commerce policy has RLS enabled'
);
select is((select refund_enabled from public.commerce_policy where id), true, 'refund is enabled by default');
select is((select refund_window_hours from public.commerce_policy where id), 48, 'refund window defaults to 48 hours');
select is((select voucher_on_cancel from public.commerce_policy where id), 'release', 'cancel returns voucher usage by default');
select is((select voucher_on_refund from public.commerce_policy where id), 'release', 'refund returns voucher usage by default');

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  (
    '00000000-0000-0000-0000-000000000000', '91919191-9191-4191-8191-919191919191',
    'authenticated', 'authenticated', 'commerce-policy-member@beanbus.test', '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000', '92929292-9292-4292-8292-929292929292',
    'authenticated', 'authenticated', 'commerce-policy-admin@beanbus.test', '{}'::jsonb, now(), now()
  );

reset role;
update public.profiles set role = 'admin' where id = '92929292-9292-4292-8292-929292929292';

set local role authenticated;
set local request.jwt.claim.sub = '92929292-9292-4292-8292-929292929292';
select is(
  (select updated_refund_window_hours from public.update_commerce_policy(false, 72, 'consume', 'release', false, true)),
  72,
  'admin can update the refund window'
);
select is(
  (select updated_refund_enabled from public.update_commerce_policy(false, 72, 'consume', 'release', false, true)),
  false,
  'admin can disable refunds'
);
select is(
  (select updated_voucher_on_cancel from public.update_commerce_policy(false, 72, 'consume', 'release', false, true)),
  'consume',
  'admin can choose voucher behavior on cancellation'
);
select is((select count(*)::integer from public.commerce_policy_history), 3, 'policy updates write audit rows');
select is((select refund_window_hours from public.get_commerce_policy()), 72, 'admin reads the current commerce policy');
select is((select loyalty_reverse_on_cancel from public.get_commerce_policy()), false, 'loyalty reversal setting is persisted');

set local request.jwt.claim.sub = '91919191-9191-4191-8191-919191919191';
select throws_like(
  $$select * from public.update_commerce_policy(true, 48, 'release', 'release', true, true)$$,
  '%ADMIN_REQUIRED%',
  'member cannot update commerce policy'
);

select * from finish();
rollback;
