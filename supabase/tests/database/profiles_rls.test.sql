begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

select has_table('public', 'profiles', 'profiles table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has RLS enabled'
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'member-one@beanbus.test',
    '{"full_name":"Member One","role":"admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'member-two@beanbus.test',
    '{"full_name":"Member Two"}'::jsonb,
    now(),
    now()
  );

select is((select count(*)::integer from public.profiles), 2, 'auth trigger creates profiles');
select is(
  (select role::text from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  'member',
  'user metadata cannot assign an elevated role'
);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select is((select count(*)::integer from public.profiles), 1, 'member sees only their profile');
select is(
  (select count(*)::integer from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  0,
  'member cannot read another profile'
);

update public.profiles set full_name = 'Member One Updated'
where id = '11111111-1111-4111-8111-111111111111';
select is(
  (select full_name from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  'Member One Updated',
  'member can update an allowed field on their profile'
);

update public.profiles set full_name = 'Compromised'
where id = '22222222-2222-4222-8222-222222222222';

reset role;
select is(
  (select full_name from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  'Member Two',
  'member cannot update another profile'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE'),
  'authenticated clients cannot update roles'
);

update public.profiles
set role = 'admin'
where id = '11111111-1111-4111-8111-111111111111';

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select is((select count(*)::integer from public.profiles), 2, 'admin can read all profiles');

reset role;
set local role anon;
set local request.jwt.claim.sub = '';
select throws_like(
  $$select count(*)::integer from public.profiles$$,
  '%permission denied%',
  'anonymous users cannot read profiles'
);

select * from finish();
rollback;
