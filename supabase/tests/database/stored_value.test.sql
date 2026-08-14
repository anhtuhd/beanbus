begin;

create extension if not exists pgtap with schema extensions;
select plan(41);

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
select has_function(
  'public', 'expire_pending_stored_value_payments', array['integer'],
  'stored-value expiry function exists'
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
select ok(
  not has_function_privilege(
    'authenticated',
    'public.expire_pending_stored_value_payments(integer)',
    'EXECUTE'
  ),
  'members cannot run global stored-value cleanup directly'
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
    2,
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
grant select on stored_topup_intent to service_role;
set local role service_role;
create temporary table stored_topup_payment as
select * from public.create_stored_value_payment(
  'topup', (select purchase_id from stored_topup_intent), 'MB', '0937936688'
);
select matches((select payment_code from stored_topup_payment), '^DH-TP-[A-F0-9]{20}$', 'top-up payment code contains DH and has a random suffix');
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

reset role;
set local role service_role;
insert into public.wallet_topups (
  id, user_id, package_id, idempotency_key, amount_vnd, points, status, expires_at
) values (
  '99999999-9999-4999-8999-999999999901',
  '77777777-7777-4777-8777-777777777777',
  '00000000-0000-4000-8000-000000000101',
  '10000000-0000-4000-8000-000000000901',
  100000, 100000, 'pending', now() + interval '20 minutes'
);
insert into public.stored_value_payments (
  topup_id, payment_code, amount_vnd, bank_code, account_number, expires_at
) values (
  '99999999-9999-4999-8999-999999999901',
  'BT999999', 100000, 'MB', '0937936688', now() + interval '20 minutes'
);
create temporary table rotated_legacy_payment as
select * from public.create_stored_value_payment(
  'topup', '99999999-9999-4999-8999-999999999901', 'MB', '0937936688'
);
select matches(
  (select payment_code from rotated_legacy_payment),
  '^DH-TP-[A-F0-9]{20}$',
  'pending legacy payment code is rotated to a DH code'
);
select is(
  (select count(*)::integer from public.stored_value_payments where payment_code = 'BT999999'),
  0,
  'legacy pending code is no longer payable'
);
update public.wallet_topups
set status = 'expired', updated_at = now()
where id = '99999999-9999-4999-8999-999999999901';

insert into public.wallet_topups (
  id, user_id, package_id, idempotency_key, amount_vnd, points, status, expires_at
) values (
  '99999999-9999-4999-8999-999999999902',
  '77777777-7777-4777-8777-777777777777',
  '00000000-0000-4000-8000-000000000101',
  '10000000-0000-4000-8000-000000000902',
  100000, 100000, 'pending', now() - interval '1 minute'
);
insert into public.stored_value_payments (
  topup_id, payment_code, amount_vnd, bank_code, account_number, expires_at
) values (
  '99999999-9999-4999-8999-999999999902',
  'DH-TP-0123456789ABCDEF0123', 100000, 'MB', '0937936688', now() - interval '1 minute'
);
select is(
  public.expire_pending_stored_value_payments(100),
  1,
  'expired stored-value payment is cleaned up'
);
select is(
  (select status from public.wallet_topups where id = '99999999-9999-4999-8999-999999999902'),
  'expired',
  'expired cleanup updates the top-up status'
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
grant select on stored_flash_intent to service_role;
set local role service_role;
create temporary table stored_flash_payment as
select * from public.create_stored_value_payment(
  'flash_sale', (select purchase_id from stored_flash_intent), 'MB', '0937936688'
);
select matches((select payment_code from stored_flash_payment), '^DH-FS-[A-F0-9]{20}$', 'flash-sale payment code contains DH and has a random suffix');
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
