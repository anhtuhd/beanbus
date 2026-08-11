begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'phone', 'UPDATE'),
  'authenticated clients cannot update profile phone directly'
);
select ok(
  not has_function_privilege('authenticated', 'public.get_zalo_access_token()', 'EXECUTE'),
  'authenticated clients cannot read the Zalo access token'
);
select ok(
  has_function_privilege('service_role', 'public.get_zalo_access_token()', 'EXECUTE'),
  'service role can read the Zalo access token through the narrow RPC'
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  phone,
  phone_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '33333333-3333-4333-8333-333333333333',
  'authenticated',
  'authenticated',
  'zalo-member@beanbus.test',
  '+84937936688',
  now(),
  '{}'::jsonb,
  now(),
  now()
);

select is(
  (select phone from public.profiles where id = '33333333-3333-4333-8333-333333333333'),
  '+84937936688',
  'new profiles receive a confirmed Auth phone'
);

update auth.users
set phone = '+84987654321',
    phone_confirmed_at = now()
where id = '33333333-3333-4333-8333-333333333333';

select is(
  (select phone from public.profiles where id = '33333333-3333-4333-8333-333333333333'),
  '+84987654321',
  'confirmed Auth phone changes sync to the profile'
);

update auth.users
set phone_change = '+84911111111',
    phone_change_token = 'stale-token',
    phone_change_sent_at = now() - interval '16 minutes'
where id = '33333333-3333-4333-8333-333333333333';

select is(private.clear_stale_phone_changes(), 1::bigint, 'stale pending phone change is cleared');
select is(
  (select phone_change from auth.users where id = '33333333-3333-4333-8333-333333333333'),
  '',
  'stale pending phone number is removed'
);

select vault.create_secret(
  'test-access-token-000000000000',
  'zalo_oa_access_token',
  'Test access token'
);
select vault.create_secret(
  'test-refresh-token-00000000000',
  'zalo_oa_refresh_token',
  'Test refresh token'
);

set local role service_role;
select public.initialize_zalo_oauth_state(now() + interval '5 minutes');

select is(
  public.get_zalo_access_token(),
  'test-access-token-000000000000',
  'service role reads the configured access token'
);

create temporary table first_lease as
select * from public.claim_zalo_token_refresh();

select is((select count(*)::integer from first_lease), 1, 'first worker claims the refresh lease');
select is(
  (select refresh_token from first_lease),
  'test-refresh-token-00000000000',
  'refresh lease returns the rotating token to service role only'
);
select is(
  (select count(*)::integer from public.claim_zalo_token_refresh()),
  0,
  'a concurrent worker cannot claim the active lease'
);
select ok(
  public.complete_zalo_token_refresh(
    (select lease_id from first_lease),
    (select version from first_lease),
    'next-access-token-000000000000',
    'next-refresh-token-00000000000',
    now() + interval '25 hours'
  ),
  'lease owner can atomically rotate both tokens'
);
select is(
  public.get_zalo_access_token(),
  'next-access-token-000000000000',
  'completed refresh exposes the new access token'
);
select is(
  (select count(*)::integer from public.claim_zalo_token_refresh()),
  0,
  'fresh token is not refreshed again before the threshold'
);

reset role;

select is(
  (select count(*)::integer from cron.job where jobname in (
    'beanbus-clear-stale-phone-changes',
    'beanbus-refresh-zalo-token'
  )),
  0,
  'cleanup and token refresh cron jobs remain disabled in Google-only release'
);

select * from finish();
rollback;
