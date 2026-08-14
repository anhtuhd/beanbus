begin;

create extension if not exists pgtap with schema extensions;
select plan(5);

select has_function(
  'public', 'get_member_payment_history', array['integer', 'integer'],
  'member payment history RPC exists'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.get_member_payment_history(integer, integer)',
    'EXECUTE'
  ),
  'anonymous users cannot execute payment history RPC'
);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '99999999-9999-4999-8999-999999999991', 'authenticated', 'authenticated', 'history-member@beanbus.test', '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '99999999-9999-4999-8999-999999999992', 'authenticated', 'authenticated', 'history-other@beanbus.test', '{}'::jsonb, now(), now());

reset role;
set local role service_role;
insert into public.wallet_topups (id, user_id, package_id, idempotency_key, amount_vnd, points, status, expires_at, paid_at)
values
  ('99999999-9999-4999-8999-999999999901', '99999999-9999-4999-8999-999999999991', '00000000-0000-4000-8000-000000000101', extensions.gen_random_uuid(), 100000, 100000, 'paid', now() + interval '20 minutes', now()),
  ('99999999-9999-4999-8999-999999999902', '99999999-9999-4999-8999-999999999992', '00000000-0000-4000-8000-000000000101', extensions.gen_random_uuid(), 100000, 100000, 'paid', now() + interval '20 minutes', now());
insert into public.stored_value_payments (
  id, topup_id, payment_code, amount_vnd, bank_code, account_number, status, provider_transaction_id, expires_at, paid_at
)
values
  ('99999999-9999-4999-8999-999999999911', '99999999-9999-4999-8999-999999999901', 'DH-TP-0123456789ABCDEF0123', 100000, 'MB', '0937936688', 'paid', 999991, now() + interval '20 minutes', now()),
  ('99999999-9999-4999-8999-999999999912', '99999999-9999-4999-8999-999999999902', 'DH-TP-ABCDEF0123456789ABCD', 100000, 'MB', '0937936688', 'paid', 999992, now() + interval '20 minutes', now());

set local role authenticated;
set local request.jwt.claim.sub = '99999999-9999-4999-8999-999999999991';
select is(
  (select count(*)::integer from public.get_member_payment_history(1, 20)),
  1,
  'member history returns only the current member rows'
);
select is(
  (select payment_code from public.get_member_payment_history(1, 20)),
  'DH-TP-0123456789ABCDEF0123',
  'member history returns the DH transaction code'
);
select is(
  (select total_count::integer from public.get_member_payment_history(1, 20)),
  1,
  'member history exposes the filtered total count'
);

select * from finish();
rollback;
