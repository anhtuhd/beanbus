begin;

create extension if not exists pgtap with schema extensions;
select plan(17);

select has_table('public', 'catalog_menus', 'menu table exists');
select has_table('public', 'catalog_menu_schedules', 'menu schedules table exists');
select has_table('public', 'catalog_menu_sections', 'menu sections table exists');
select has_table('public', 'catalog_menu_items', 'menu items table exists');
select has_table('public', 'catalog_releases', 'catalog releases table exists');
select has_function('public', 'save_catalog_draft', array['jsonb', 'bigint'], 'save draft RPC exists');
select has_function('public', 'publish_catalog_draft', array['bigint'], 'publish draft RPC exists');
select has_function('public', 'product_is_orderable', array['text'], 'orderable product helper exists');
select has_function('public', 'enforce_catalog_media_url', array[]::text[], 'catalog media URL guard exists');
select is((select count(*)::integer from public.catalog_menus), 1, 'initial menu is seeded');
select is((select count(*)::integer from public.catalog_releases where status = 'draft'), 1, 'one draft release is seeded');
select ok((select count(*) > 0 from public.catalog_menu_sections), 'initial menu has sections');
select ok((select count(*) > 0 from public.catalog_menu_items), 'initial menu has items');
select ok(not has_table_privilege('authenticated', 'public.catalog_releases', 'UPDATE'), 'authenticated cannot update releases directly');
select ok(has_function_privilege('authenticated', 'public.save_catalog_draft(jsonb,bigint)', 'EXECUTE'), 'authenticated can save through RPC');

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '77777777-7777-4777-8777-777777777777', 'authenticated', 'authenticated', 'menu-builder-admin@beanbus.test', now(), now());
update public.profiles set role = 'admin' where id = '77777777-7777-4777-8777-777777777777';
set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-4777-8777-777777777777';

select is(
  (select lock_version from public.save_catalog_draft(
    jsonb_set((select snapshot from public.catalog_releases where status = 'draft'), '{menus,0,nameVi}', '"Beanbus Cả ngày mới"'::jsonb),
    (select lock_version from public.catalog_releases where status = 'draft')
  )),
  2::bigint,
  'save draft increments optimistic lock'
);
select throws_like(
  $$select * from public.save_catalog_draft((select snapshot from public.catalog_releases where status = 'draft'), 1)$$,
  '%CATALOG_VERSION_CONFLICT%',
  'stale draft save is rejected'
);

select * from finish();
rollback;
