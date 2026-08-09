begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

select has_table('public', 'catalog_categories', 'catalog categories table exists');
select has_table('public', 'catalog_option_sets', 'catalog option sets table exists');
select has_table('public', 'catalog_options', 'catalog options table exists');
select has_table('public', 'products', 'products table exists');

select is((select count(*)::integer from public.catalog_categories), 9, 'category seed is complete');
select is((select count(*)::integer from public.products), 14, 'product seed is complete');
select is((select count(*)::integer from public.catalog_options), 10, 'shared option seed is complete');

insert into auth.users (
  instance_id, id, aud, role, email, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-4333-8333-333333333333',
    'authenticated',
    'authenticated',
    'catalog-member@beanbus.test',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '44444444-4444-4444-8444-444444444444',
    'authenticated',
    'authenticated',
    'catalog-admin@beanbus.test',
    now(),
    now()
  );

update public.profiles
set role = 'admin'
where id = '44444444-4444-4444-8444-444444444444';

set local role anon;
select is((select count(*)::integer from public.products), 14, 'anonymous visitors see published products');
update public.products set price_vnd = 1 where id = 'cd-1';

reset role;
select is((select price_vnd from public.products where id = 'cd-1'), 35000, 'anonymous visitors cannot change prices');

set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
update public.products set price_vnd = 1 where id = 'cd-1';

reset role;
select is((select price_vnd from public.products where id = 'cd-1'), 35000, 'members cannot change prices');

set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
update public.products set is_available = false where id = 'cd-1';
select is((select is_available from public.products where id = 'cd-1'), false, 'admins can update catalog state');
update public.products set is_published = false where id = 'cd-1';

set local role anon;
select is((select count(*)::integer from public.products), 13, 'anonymous visitors cannot see unpublished products');

select * from finish();
rollback;
