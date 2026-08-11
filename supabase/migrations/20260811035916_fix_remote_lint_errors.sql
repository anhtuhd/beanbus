create or replace function public.get_member_loyalty_summary(p_user_id uuid)
returns table (
  policy_enabled boolean,
  balance_points bigint,
  earned_points bigint,
  redeemed_points bigint,
  total_spent_vnd bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_user_id is null
    or ((select auth.uid()) is distinct from p_user_id
      and (select public.current_user_role()) is distinct from 'admin')
  then
    raise exception 'LOYALTY_FORBIDDEN';
  end if;

  return query
  select policy.enabled,
    coalesce((
      select sum(ledger.points) from public.loyalty_ledger as ledger
      where ledger.user_id = p_user_id
    ), 0)::bigint,
    coalesce((
      select sum(ledger.points) from public.loyalty_ledger as ledger
      where ledger.user_id = p_user_id and ledger.points > 0
    ), 0)::bigint,
    abs(coalesce((
      select sum(ledger.points) from public.loyalty_ledger as ledger
      where ledger.user_id = p_user_id and ledger.points < 0
    ), 0))::bigint,
    coalesce((
      select sum(orders.total_vnd) from public.orders
      where orders.user_id = p_user_id
        and orders.status = 'completed'
        and (orders.payment_status = 'paid' or orders.payment_method = 'cod')
    ), 0)::bigint
  from public.loyalty_policy as policy
  where policy.id;
end;
$$;

create or replace function public.admin_upsert_event(
  p_event_id text,
  p_slug text,
  p_title_vi text,
  p_title_en text,
  p_summary_vi text,
  p_summary_en text,
  p_description_vi text,
  p_description_en text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_time_label text,
  p_location text,
  p_image_url text,
  p_max_seats integer,
  p_is_featured boolean,
  p_is_published boolean,
  p_sort_order integer
)
returns table (updated_event_id text, operation text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_event_id text := nullif(trim(p_event_id), '');
  v_before jsonb;
  v_after jsonb;
  v_operation text;
begin
  if (select public.current_user_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{0,119}$'
    or p_title_vi is null or char_length(trim(p_title_vi)) not between 3 and 180
    or p_title_en is null or char_length(trim(p_title_en)) not between 3 and 180
    or p_summary_vi is null or char_length(p_summary_vi) not between 10 and 500
    or p_summary_en is null or char_length(p_summary_en) not between 10 and 500
    or p_description_vi is null or char_length(p_description_vi) not between 20 and 10000
    or p_description_en is null or char_length(p_description_en) not between 20 and 10000
    or p_starts_at is null or p_time_label is null or char_length(trim(p_time_label)) not between 3 and 50
    or p_location is null or char_length(trim(p_location)) not between 3 and 300
    or p_image_url is null or p_image_url !~ '^https://'
    or (p_ends_at is not null and p_ends_at <= p_starts_at)
    or (p_max_seats is not null and p_max_seats <= 0)
    or p_is_featured is null or p_is_published is null or p_sort_order is null or p_sort_order < 0 then
    raise exception 'INVALID_EVENT';
  end if;

  if v_event_id is null then
    v_event_id := 'event-' || encode(extensions.gen_random_bytes(8), 'hex');
  else
    select * into v_event from public.events where id = v_event_id for update;
    if not found then raise exception 'EVENT_NOT_FOUND'; end if;
    v_before := to_jsonb(v_event);
  end if;

  insert into public.events (
    id, slug, title_vi, title_en, summary_vi, summary_en, description_vi, description_en,
    starts_at, ends_at, time_label, location, image_url, max_seats, is_featured,
    is_published, published_at, sort_order
  ) values (
    v_event_id, trim(p_slug), trim(p_title_vi), trim(p_title_en), p_summary_vi, p_summary_en,
    p_description_vi, p_description_en, p_starts_at, p_ends_at, trim(p_time_label), trim(p_location),
    p_image_url, p_max_seats, p_is_featured, p_is_published,
    case when p_is_published then now() else null end, p_sort_order
  )
  on conflict (id) do update set
    slug = excluded.slug, title_vi = excluded.title_vi, title_en = excluded.title_en,
    summary_vi = excluded.summary_vi, summary_en = excluded.summary_en,
    description_vi = excluded.description_vi, description_en = excluded.description_en,
    starts_at = excluded.starts_at, ends_at = excluded.ends_at, time_label = excluded.time_label,
    location = excluded.location, image_url = excluded.image_url, max_seats = excluded.max_seats,
    is_featured = excluded.is_featured, is_published = excluded.is_published,
    published_at = case when excluded.is_published then coalesce(public.events.published_at, now()) else null end,
    sort_order = excluded.sort_order;

  v_operation := case when v_before is null then 'created' else 'updated' end;
  select to_jsonb(events) into v_after from public.events where id = v_event_id;
  insert into public.content_change_history (content_type, content_id, operation, before_data, after_data, actor_user_id)
  values ('event', v_event_id, v_operation, v_before, v_after, (select auth.uid()));
  return query select v_event_id, v_operation;
end;
$$;

create or replace function public.admin_upsert_blog_post(
  p_post_id text,
  p_slug text,
  p_title_vi text,
  p_title_en text,
  p_category_vi text,
  p_category_en text,
  p_author text,
  p_read_time_vi text,
  p_read_time_en text,
  p_excerpt_vi text,
  p_excerpt_en text,
  p_content_vi text,
  p_content_en text,
  p_cover_image_url text,
  p_is_published boolean,
  p_sort_order integer
)
returns table (updated_post_id text, operation text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post public.blog_posts%rowtype;
  v_post_id text := nullif(trim(p_post_id), '');
  v_before jsonb;
  v_after jsonb;
  v_operation text;
begin
  if (select public.current_user_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{0,119}$'
    or p_title_vi is null or char_length(trim(p_title_vi)) not between 3 and 180
    or p_title_en is null or char_length(trim(p_title_en)) not between 3 and 180
    or p_category_vi is null or char_length(trim(p_category_vi)) not between 2 and 80
    or p_category_en is null or char_length(trim(p_category_en)) not between 2 and 80
    or p_author is null or char_length(trim(p_author)) not between 2 and 100
    or p_read_time_vi is null or char_length(trim(p_read_time_vi)) not between 2 and 40
    or p_read_time_en is null or char_length(trim(p_read_time_en)) not between 2 and 40
    or p_excerpt_vi is null or char_length(p_excerpt_vi) not between 10 and 500
    or p_excerpt_en is null or char_length(p_excerpt_en) not between 10 and 500
    or p_content_vi is null or char_length(p_content_vi) not between 50 and 50000
    or p_content_en is null or char_length(p_content_en) not between 50 and 50000
    or p_cover_image_url is null or p_cover_image_url !~ '^https://'
    or p_is_published is null or p_sort_order is null or p_sort_order < 0 then
    raise exception 'INVALID_BLOG_POST';
  end if;

  if v_post_id is null then
    v_post_id := 'post-' || encode(extensions.gen_random_bytes(8), 'hex');
  else
    select * into v_post from public.blog_posts where id = v_post_id for update;
    if not found then raise exception 'BLOG_POST_NOT_FOUND'; end if;
    v_before := to_jsonb(v_post);
  end if;

  insert into public.blog_posts (
    id, slug, title_vi, title_en, category_vi, category_en, author, read_time_vi, read_time_en,
    excerpt_vi, excerpt_en, content_vi, content_en, cover_image_url, is_published, published_at, sort_order
  ) values (
    v_post_id, trim(p_slug), trim(p_title_vi), trim(p_title_en), trim(p_category_vi), trim(p_category_en),
    trim(p_author), trim(p_read_time_vi), trim(p_read_time_en), p_excerpt_vi, p_excerpt_en,
    p_content_vi, p_content_en, p_cover_image_url, p_is_published,
    case when p_is_published then now() else null end, p_sort_order
  )
  on conflict (id) do update set
    slug = excluded.slug, title_vi = excluded.title_vi, title_en = excluded.title_en,
    category_vi = excluded.category_vi, category_en = excluded.category_en, author = excluded.author,
    read_time_vi = excluded.read_time_vi, read_time_en = excluded.read_time_en,
    excerpt_vi = excluded.excerpt_vi, excerpt_en = excluded.excerpt_en,
    content_vi = excluded.content_vi, content_en = excluded.content_en,
    cover_image_url = excluded.cover_image_url, is_published = excluded.is_published,
    published_at = case when excluded.is_published then coalesce(public.blog_posts.published_at, now()) else null end,
    sort_order = excluded.sort_order;

  v_operation := case when v_before is null then 'created' else 'updated' end;
  select to_jsonb(blog_posts) into v_after from public.blog_posts where id = v_post_id;
  insert into public.content_change_history (content_type, content_id, operation, before_data, after_data, actor_user_id)
  values ('blog_post', v_post_id, v_operation, v_before, v_after, (select auth.uid()));
  return query select v_post_id, v_operation;
end;
$$;
