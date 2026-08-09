create table public.content_publication_history (
  id bigint generated always as identity primary key,
  content_type text not null check (content_type in ('event', 'blog_post')),
  content_id text not null,
  from_is_published boolean not null,
  to_is_published boolean not null,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index content_publication_history_content_idx
on public.content_publication_history (content_type, content_id, created_at desc);

alter table public.content_publication_history enable row level security;
revoke all on table public.content_publication_history from anon, authenticated;
grant select on table public.content_publication_history to authenticated;
grant all on table public.content_publication_history to service_role;

create policy "Admins read content publication history"
on public.content_publication_history for select to authenticated
using ((select public.current_user_role()) = 'admin');

create function public.update_event_publication(p_event_id text, p_is_published boolean)
returns table (updated_event_id text, updated_is_published boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
begin
  if (select public.current_user_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_event_id is null or p_event_id !~ '^event-[a-z0-9][a-z0-9-]{0,92}$'
    or p_is_published is null then raise exception 'INVALID_EVENT_PUBLICATION'; end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if v_event.is_published is not distinct from p_is_published then
    return query select v_event.id, v_event.is_published;
    return;
  end if;

  update public.events set
    is_published = p_is_published,
    published_at = case when p_is_published then coalesce(published_at, now()) else null end
  where id = v_event.id;

  insert into public.content_publication_history (
    content_type, content_id, from_is_published, to_is_published, actor_user_id
  ) values ('event', v_event.id, v_event.is_published, p_is_published, (select auth.uid()));

  return query select v_event.id, p_is_published;
end;
$$;

create function public.update_blog_post_publication(p_post_id text, p_is_published boolean)
returns table (updated_post_id text, updated_is_published boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post public.blog_posts%rowtype;
begin
  if (select public.current_user_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_post_id is null or p_post_id !~ '^post-[a-z0-9][a-z0-9-]{0,93}$'
    or p_is_published is null then raise exception 'INVALID_BLOG_PUBLICATION'; end if;

  select * into v_post from public.blog_posts where id = p_post_id for update;
  if not found then raise exception 'BLOG_POST_NOT_FOUND'; end if;
  if v_post.is_published is not distinct from p_is_published then
    return query select v_post.id, v_post.is_published;
    return;
  end if;

  update public.blog_posts set
    is_published = p_is_published,
    published_at = case when p_is_published then coalesce(published_at, now()) else null end
  where id = v_post.id;

  insert into public.content_publication_history (
    content_type, content_id, from_is_published, to_is_published, actor_user_id
  ) values ('blog_post', v_post.id, v_post.is_published, p_is_published, (select auth.uid()));

  return query select v_post.id, p_is_published;
end;
$$;

revoke all on function public.update_event_publication(text, boolean) from public;
revoke all on function public.update_blog_post_publication(text, boolean) from public;
grant execute on function public.update_event_publication(text, boolean) to authenticated;
grant execute on function public.update_blog_post_publication(text, boolean) to authenticated;
