begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

select has_function(
  'public', 'redeem_loyalty_reward',
  array['text', 'uuid'],
  'loyalty redemption function exists'
);

insert into auth.users (
  instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '55555555-5555-4555-8555-555555555555',
    'authenticated', 'authenticated', 'redemption-member@beanbus.test', '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '66666666-6666-4666-8666-666666666666',
    'authenticated', 'authenticated', 'redemption-other@beanbus.test', '{}'::jsonb, now(), now()
  );

update public.loyalty_policy
set enabled = true, earn_bps = 1000, cod_eligible = false;

insert into public.loyalty_rewards (
  id, name_vi, name_en, points_cost, discount_type, discount_value,
  minimum_subtotal_vnd, maximum_discount_vnd, is_active
)
values (
  'redemption-test', 'Mã thử nghiệm', 'Test reward', 100, 'fixed', 10000,
  0, null, true
);

insert into public.loyalty_ledger (
  user_id, points, amount_vnd, source_type, source_key, note
)
values (
  '55555555-5555-4555-8555-555555555555', 100, 0, 'manual_adjustment',
  'manual:redemption-test', 'Test balance'
);

set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';
create temporary table first_redemption as
select * from public.redeem_loyalty_reward(
  'redemption-test', '77777777-7777-4777-8777-777777777777'
);
create temporary table retried_redemption as
select * from public.redeem_loyalty_reward(
  'redemption-test', '77777777-7777-4777-8777-777777777777'
);

select is((select points_spent from first_redemption), 100, 'first redemption spends the reward cost');
select matches((select voucher_code from first_redemption), '^REWARD-', 'first redemption returns an owned voucher code');
select is((select voucher_code from retried_redemption), (select voucher_code from first_redemption), 'same-user retry returns the original voucher');
select is((select points_spent from retried_redemption), 100, 'same-user retry reports the original points');
select is(
  (select count(*)::integer from public.loyalty_ledger where source_key = 'redemption:77777777-7777-4777-8777-777777777777'),
  1,
  'same-user retry creates one redemption ledger row'
);
select is(
  (select count(*)::integer from public.vouchers where assigned_user_id = '55555555-5555-4555-8555-555555555555'),
  1,
  'same-user retry creates one owned voucher'
);
select is(
  (select coalesce(sum(points), 0)::integer from public.loyalty_ledger where user_id = '55555555-5555-4555-8555-555555555555'),
  0,
  'redemption debits the member balance once'
);

set local request.jwt.claim.sub = '66666666-6666-4666-8666-666666666666';
select throws_like(
  $$select * from public.redeem_loyalty_reward(
    'redemption-test', '77777777-7777-4777-8777-777777777777'
  )$$,
  '%IDEMPOTENCY_CONFLICT%',
  'cross-user idempotency collision is rejected without returning the voucher'
);
select is(
  (select count(*)::integer from public.vouchers
   where code = (select voucher_code from first_redemption)
     and assigned_user_id = '66666666-6666-4666-8666-666666666666'),
  0,
  'cross-user collision creates no voucher for the second member'
);
select is(
  (select count(*)::integer from public.loyalty_ledger
   where source_key = 'redemption:77777777-7777-4777-8777-777777777777'
     and user_id = '66666666-6666-4666-8666-666666666666'),
  0,
  'cross-user collision creates no ledger row for the second member'
);

reset role;
select * from finish();
rollback;
