create table public.product_change_history (
  id bigint generated always as identity primary key,
  product_id text not null,
  operation text not null check (operation in ('created', 'updated')),
  before_data jsonb,
  after_data jsonb not null,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index product_change_history_product_idx
on public.product_change_history (product_id, created_at desc);

alter table public.product_change_history enable row level security;
revoke all on table public.product_change_history from anon, authenticated;
grant select on table public.product_change_history to authenticated;
grant all on table public.product_change_history to service_role;

create policy "Admins read product change history"
on public.product_change_history for select to authenticated
using ((select public.current_user_role()) = 'admin');

create function public.admin_upsert_product(
  p_product_id text,
  p_category_id text,
  p_option_set_id text,
  p_name_vi text,
  p_name_en text,
  p_description_vi text,
  p_description_en text,
  p_price_vnd integer,
  p_image_url text,
  p_badge text,
  p_tasting_notes text,
  p_sort_order integer,
  p_is_available boolean,
  p_is_published boolean
)
returns table (
  updated_product_id text,
  operation text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_product_id text := nullif(trim(p_product_id), '');
  v_operation text;
  v_before jsonb;
  v_after jsonb;
begin
  if (select public.current_user_role()) is distinct from 'admin' then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if p_category_id is null or p_name_vi is null or char_length(trim(p_name_vi)) not between 1 and 160
    or p_name_en is null or char_length(trim(p_name_en)) not between 1 and 160
    or p_description_vi is null or char_length(p_description_vi) > 2000
    or p_description_en is null or char_length(p_description_en) > 2000
    or p_price_vnd is null or p_price_vnd < 0
    or p_image_url is null or p_image_url !~ '^https?://'
    or p_sort_order is null or p_sort_order < 0
    or p_is_available is null or p_is_published is null then
    raise exception 'INVALID_PRODUCT';
  end if;
  if p_badge is not null and p_badge not in ('best', 'seasonal', 'new', 'signature') then
    raise exception 'INVALID_PRODUCT_BADGE';
  end if;
  if not exists (select 1 from public.catalog_categories where id = p_category_id) then
    raise exception 'CATEGORY_NOT_FOUND';
  end if;
  if p_option_set_id is not null and not exists (select 1 from public.catalog_option_sets where id = p_option_set_id) then
    raise exception 'OPTION_SET_NOT_FOUND';
  end if;

  if v_product_id is null then
    v_product_id := gen_random_uuid()::text;
  else
    select * into v_product from public.products where id = v_product_id for update;
    if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
    v_before := to_jsonb(v_product);
  end if;

  insert into public.products (
    id, category_id, option_set_id, name_vi, name_en, description_vi, description_en,
    price_vnd, image_url, badge, tasting_notes, sort_order, is_available, is_published
  ) values (
    v_product_id, p_category_id, p_option_set_id, trim(p_name_vi), trim(p_name_en),
    p_description_vi, p_description_en, p_price_vnd, trim(p_image_url), p_badge,
    nullif(trim(p_tasting_notes), ''), p_sort_order, p_is_available, p_is_published
  )
  on conflict (id) do update set
    category_id = excluded.category_id,
    option_set_id = excluded.option_set_id,
    name_vi = excluded.name_vi,
    name_en = excluded.name_en,
    description_vi = excluded.description_vi,
    description_en = excluded.description_en,
    price_vnd = excluded.price_vnd,
    image_url = excluded.image_url,
    badge = excluded.badge,
    tasting_notes = excluded.tasting_notes,
    sort_order = excluded.sort_order,
    is_available = excluded.is_available,
    is_published = excluded.is_published;

  v_operation := case when v_before is null then 'created' else 'updated' end;
  select to_jsonb(products) into v_after from public.products where id = v_product_id;
  insert into public.product_change_history (product_id, operation, before_data, after_data, actor_user_id)
  values (v_product_id, v_operation, v_before, v_after, (select auth.uid()));

  return query select v_product_id, v_operation;
end;
$$;

revoke all on function public.admin_upsert_product(text, text, text, text, text, text, text, integer, text, text, text, integer, boolean, boolean) from public;
grant execute on function public.admin_upsert_product(text, text, text, text, text, text, text, integer, text, text, text, integer, boolean, boolean) to authenticated;
