begin;

create extension if not exists pgtap with schema extensions;
select plan(35);

select has_table('public', 'stored_value_policy', 'stored-value policy table exists');
select has_table('public', 'topup_packages', 'top-up package table exists');
select has_table('public', 'flash_sale_campaigns', 'flash-sale campaign table exists');
select has_table('public', 'wallet_topups', 'wallet top-up table exists');
select has_table('public', 'flash_sale_purchases', 'flash-sale purchase table exists');
select has_table('public', 'stored_value_payments', 'stored-value payment table exists');
select has_table('public', 'stored_value_webhook_events', 'stored-value webhook ledger exists');
select has_function('public', 'create_topup_intent', array['uuid', 'uuid'], 'top-up intent function exists');
select has_function('public', 'create_flash_sale_intent', array['uuid', 'uuid'], 'flash-sale intent function exists');
select has_function(
  'public', 'process_stored_value_webhook',
  array['bigint', 'text', 'timestamp with time zone', 'text', 'text', 'text', 'integer', 'text', 'jsonb'],
  'stored-value webhook function exists'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.wallet_topups'::regclass),
  'wallet top-ups have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.stored_value_payments'::regclass),
  'stored-value payments have RLS enabled'
);
select is((select enabled from public.stored_value_policy where id), false, 'stored-value is disabled by default');
select ok(
  not has_table_privilege('authenticated', 'public.wallet_topups', 'SELECT'),
  'members cannot read wallet rows directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_stored_value_payment(text, uuid, text, text)',
    'EXECUTE'
  ),
  'members cannot create payment records directly'
);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '77777777-7777-4777-8777-777777777777',
    'authenticated', 'authenticated', 'stored-value-member@beanbus.test', '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '88888888-8888-4888-8888-888888888888',
    'authenticated', 'authenticated', 'stored-value-admin@beanbus.test', '{}'::jsonb, now(), now()
  );

reset role;
update public.profiles
set role = 'admin'
where id = '88888888-8888-4888-8888-888888888888';

set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-4777-8777-777777777777';
select throws_like(
  $$select * from public.create_topup_intent(
    '00000000-0000-4000-8000-00000000a101',
    '10000000-0000-4000-8000-000000000001'
  )$$,
  '%TOPUP_DISABLED%',
  'members cannot create top-ups while policy is disabled'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '88888888-8888-4888-8888-888888888888';
select is(
  (select updated_enabled from public.update_stored_value_policy(true, true, true)),
  true,
  'admin can enable stored-value policy'
);
select is((select count(*)::integer from public.stored_value_policy_history), 1, 'policy update writes an audit row');
select is(
  (select operation from public.admin_upsert_flash_sale_campaign(
    '00000000-0000-4000-8000-00000000f101',
    'test-flash-sale',
    'Flash test',
    'Flash test',
    50000,
    60000,
    now() - interval '1 hour',
    now() + interval '1 hour',
    1,
    1,
    true
  )),
  'created',
  'admin can create a flash-sale campaign'
);

set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-4777-8777-777777777777';
create temporary table stored_topup_intent as
select * from public.create_topup_intent(
  '00000000-0000-4000-8000-000000000101',
  '10000000-0000-4000-8000-000000000001'
);
select is((select amount_vnd from stored_topup_intent), 100000, 'top-up amount comes from the package');
select is(
  (select purchase_id from public.create_topup_intent(
    '00000000-0000-4000-8000-000000000101',
    '10000000-0000-4000-8000-000000000001'
  )),
  (select purchase_id from stored_topup_intent),
  'top-up intent retry is idempotent'
);

reset role;
set local role service_role;
create temporary table stored_topup_payment as
select * from public.create_stored_value_payment(
  'topup', (select purchase_id from stored_topup_intent), 'MB', '0937936688'
);
select matches((select payment_code from stored_topup_payment), '^BT[0-9]+$', 'top-up payment code has the BT prefix');
select is(
  (select count(*)::integer from public.create_stored_value_payment(
    'topup', (select purchase_id from stored_topup_intent), 'MB', '0937936688'
  )),
  1,
  'stored-value payment creation retry is idempotent'
);
select is(
  (select outcome from public.process_stored_value_webhook(
    91001, 'MBBank', now(), '0937936688', (select payment_code from stored_topup_payment),
    'in', 100000, 'FT-STORED-001', '{"id":91001,"transferType":"in"}'::jsonb
  )),
  'processed',
  'matching top-up transfer is processed'
);
select is(
  (select status from public.wallet_topups where id = (select purchase_id from stored_topup_intent)),
  'paid',
  'verified top-up marks the purchase paid'
);
select is(
  (select count(*)::integer from public.loyalty_ledger where source_type = 'topup_credited'),
  1,
  'verified top-up credits the ledger once'
);
select is(
  (select outcome from public.process_stored_value_webhook(
    91001, 'MBBank', now(), '0937936688', (select payment_code from stored_topup_payment),
    'in', 100000, 'FT-STORED-001', '{"id":91001,"transferType":"in"}'::jsonb
  )),
  'duplicate',
  'duplicate top-up webhook is ignored'
);
select is(
  (select count(*)::integer from public.loyalty_ledger where source_type = 'topup_credited'),
  1,
  'duplicate top-up webhook does not duplicate points'
);

set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-4777-8777-777777777777';
create temporary table stored_flash_intent as
select * from public.create_flash_sale_intent(
  '00000000-0000-4000-8000-00000000f101',
  '10000000-0000-4000-8000-000000000002'
);
select is((select amount_vnd from stored_flash_intent), 50000, 'flash-sale price comes from the campaign');

reset role;
set local role service_role;
create temporary table stored_flash_payment as
select * from public.create_stored_value_payment(
  'flash_sale', (select purchase_id from stored_flash_intent), 'MB', '0937936688'
);
select matches((select payment_code from stored_flash_payment), '^BF[0-9]+$', 'flash-sale payment code has the BF prefix');
select is(
  (select outcome from public.process_stored_value_webhook(
    91002, 'MBBank', now(), '0937936688', (select payment_code from stored_flash_payment),
    'in', 50000, 'FT-STORED-002', '{"id":91002,"transferType":"in"}'::jsonb
  )),
  'processed',
  'matching flash-sale transfer is processed'
);
select is((select quota_reserved from public.flash_sale_campaigns where id = '00000000-0000-4000-8000-00000000f101'), 0, 'paid flash-sale releases the reservation');
select is((select quota_sold from public.flash_sale_campaigns where id = '00000000-0000-4000-8000-00000000f101'), 1, 'paid flash-sale consumes one sold quota');
select is(
  (select count(*)::integer from public.loyalty_ledger where source_type = 'flash_sale_credited'),
  1,
  'verified flash-sale credits the ledger once'
);

set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-4777-8777-777777777777';
select throws_like(
  $$select * from public.create_flash_sale_intent(
    '00000000-0000-4000-8000-00000000f101',
    '10000000-0000-4000-8000-000000000003'
  )$$,
  '%FLASH_SALE_USER_LIMIT%',
  'flash-sale max-per-user is enforced'
);

select * from finish();
rollback;
