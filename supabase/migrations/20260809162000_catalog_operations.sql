create table public.product_status_history (
  id bigint generated always as identity primary key,
  product_id text not null references public.products (id) on delete restrict,
  from_is_available boolean not null,
  to_is_available boolean not null,
  from_is_published boolean not null,
  to_is_published boolean not null,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index product_status_history_product_idx
on public.product_status_history (product_id, created_at desc);

alter table public.product_status_history enable row level security;
revoke all on table public.product_status_history from anon, authenticated;
grant select on table public.product_status_history to authenticated;
grant all on table public.product_status_history to service_role;

create policy "Admins read product status history"
on public.product_status_history for select to authenticated
using ((select public.current_user_role()) = 'admin');

revoke insert, update, delete on table public.catalog_categories from authenticated;
revoke insert, update, delete on table public.catalog_option_sets from authenticated;
revoke insert, update, delete on table public.catalog_options from authenticated;
revoke insert, update, delete on table public.products from authenticated;

create function public.update_product_status(
  p_product_id text,
  p_is_available boolean,
  p_is_published boolean
)
returns table (
  updated_product_id text,
  updated_is_available boolean,
  updated_is_published boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
begin
  if (select public.current_user_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_product_id is null or char_length(p_product_id) not between 1 and 100
    or p_is_available is null or p_is_published is null then
    raise exception 'INVALID_PRODUCT_STATUS';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id
  for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;

  if v_product.is_available is not distinct from p_is_available
    and v_product.is_published is not distinct from p_is_published then
    return query select v_product.id, v_product.is_available, v_product.is_published;
    return;
  end if;

  update public.products set
    is_available = p_is_available,
    is_published = p_is_published
  where id = v_product.id;

  insert into public.product_status_history (
    product_id, from_is_available, to_is_available,
    from_is_published, to_is_published, actor_user_id
  ) values (
    v_product.id, v_product.is_available, p_is_available,
    v_product.is_published, p_is_published, (select auth.uid())
  );

  return query select v_product.id, p_is_available, p_is_published;
end;
$$;

revoke all on function public.update_product_status(text, boolean, boolean) from public;
grant execute on function public.update_product_status(text, boolean, boolean) to authenticated;
