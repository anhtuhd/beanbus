begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

select has_table('public', 'events', 'events table exists');
select has_table('public', 'blog_posts', 'blog posts table exists');
select has_trigger('public', 'events', 'events_set_updated_at', 'event updates maintain timestamps');
select is((select count(*)::integer from public.events), 3, 'event seed is complete');
select is((select count(*)::integer from public.blog_posts), 2, 'blog seed is complete');

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  (
    '00000000-0000-0000-0000-000000000000', '77777777-7777-4777-8777-777777777777',
    'authenticated', 'authenticated', 'content-member@beanbus.test', '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000', '88888888-8888-4888-8888-888888888888',
    'authenticated', 'authenticated', 'content-admin@beanbus.test', '{}'::jsonb, now(), now()
  );

insert into public.events (
  id, slug, title_vi, title_en, summary_vi, summary_en, description_vi, description_en,
  starts_at, time_label, location, image_url, is_published
) values (
  'event-draft', 'event-draft', 'Sự kiện bản nháp', 'Draft event',
  'Nội dung tóm tắt cho sự kiện bản nháp.', 'Summary for a draft event.',
  'Nội dung chi tiết đủ dài cho sự kiện bản nháp chưa công bố.',
  'Long enough description for this unpublished draft event.',
  now() + interval '10 days', '09:00 - 10:00', 'Beanbus Coffee Roaster',
  'https://images.unsplash.com/draft', false
);

set local role anon;
select is((select count(*)::integer from public.events), 3, 'anonymous sees only published events');
select is((select count(*)::integer from public.blog_posts), 2, 'anonymous sees only published posts');

set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-4777-8777-777777777777';
select is((select count(*)::integer from public.events), 3, 'member sees only published events');

reset role;
update public.profiles set role = 'admin' where id = '88888888-8888-4888-8888-888888888888';
set local role authenticated;
set local request.jwt.claim.sub = '88888888-8888-4888-8888-888888888888';
select is((select count(*)::integer from public.events), 4, 'admin sees draft events');

reset role;
select ok(not has_table_privilege('authenticated', 'public.events', 'UPDATE'), 'browser roles cannot update events directly');
select ok(not has_table_privilege('authenticated', 'public.blog_posts', 'UPDATE'), 'browser roles cannot update blog directly');
select ok(not has_table_privilege('authenticated', 'public.events', 'INSERT'), 'browser roles cannot insert events directly');
select ok(not has_table_privilege('authenticated', 'public.blog_posts', 'DELETE'), 'browser roles cannot delete posts directly');
select throws_like(
  $$insert into public.events (
    id, slug, title_vi, title_en, summary_vi, summary_en, description_vi, description_en,
    starts_at, time_label, location, image_url
  ) values (
    'event-invalid', 'event-invalid', 'Sự kiện lỗi', 'Invalid event',
    'Nội dung tóm tắt hợp lệ cho bài kiểm thử.', 'Valid summary for this test event.',
    'Nội dung chi tiết đủ dài cho bài kiểm thử ràng buộc URL.',
    'Long enough event description for the URL constraint test.',
    now() + interval '1 day', '09:00 - 10:00', 'Beanbus', 'http://insecure.example/image.jpg'
  )$$,
  '%events_image_url_check%',
  'event images require HTTPS'
);

select * from finish();
rollback;
