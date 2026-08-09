begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

select has_table('public', 'content_publication_history', 'content publication history exists');
select has_function('public', 'update_event_publication', array['text', 'boolean'], 'event publication RPC exists');
select has_function('public', 'update_blog_post_publication', array['text', 'boolean'], 'blog publication RPC exists');

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  (
    '00000000-0000-0000-0000-000000000000', '99999999-9999-4999-8999-999999999999',
    'authenticated', 'authenticated', 'content-ops-member@beanbus.test', '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000', 'aaaaaaaa-9999-4999-8999-999999999999',
    'authenticated', 'authenticated', 'content-ops-admin@beanbus.test', '{}'::jsonb, now(), now()
  );

set local role authenticated;
set local request.jwt.claim.sub = '99999999-9999-4999-8999-999999999999';
select throws_like(
  $$select * from public.update_event_publication('event-1', false)$$,
  '%ADMIN_REQUIRED%',
  'member cannot change event publication'
);
select throws_like(
  $$select * from public.update_blog_post_publication('post-1', false)$$,
  '%ADMIN_REQUIRED%',
  'member cannot change blog publication'
);

reset role;
update public.profiles set role = 'admin' where id = 'aaaaaaaa-9999-4999-8999-999999999999';
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-9999-4999-8999-999999999999';

select is(
  (select updated_is_published from public.update_event_publication('event-1', false)),
  false,
  'admin can unpublish an event'
);
select is((select count(*)::integer from public.content_publication_history), 1, 'event change writes one audit row');
select is(
  (select actor_user_id from public.content_publication_history),
  'aaaaaaaa-9999-4999-8999-999999999999'::uuid,
  'publication audit records the admin actor'
);
select is(
  (select updated_is_published from public.update_event_publication('event-1', false)),
  false,
  'same event publication is idempotent'
);
select is((select count(*)::integer from public.content_publication_history), 1, 'idempotent event retry adds no audit row');
select is(
  (select updated_is_published from public.update_blog_post_publication('post-1', false)),
  false,
  'admin can unpublish a blog post'
);
select is(
  (select content_type from public.content_publication_history order by id desc limit 1),
  'blog_post',
  'blog publication audit records its content type'
);

select * from finish();
rollback;
