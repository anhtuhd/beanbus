create function public.admin_archive_product(p_product_id text)
returns table (
  archived_product_id text,
  archived boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
begin
  if (select public.current_user_role()) is distinct from 'admin' then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if p_product_id is null or char_length(trim(p_product_id)) not between 1 and 100 then
    raise exception 'INVALID_PRODUCT';
  end if;

  select * into v_product
  from public.products
  where id = trim(p_product_id)
  for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;

  if v_product.is_available or v_product.is_published then
    update public.products
    set is_available = false, is_published = false
    where id = v_product.id;

    insert into public.product_status_history (
      product_id, from_is_available, to_is_available,
      from_is_published, to_is_published, actor_user_id
    ) values (
      v_product.id, v_product.is_available, false,
      v_product.is_published, false, (select auth.uid())
    );
  end if;

  return query select v_product.id, true;
end;
$$;

revoke all on function public.admin_archive_product(text) from public;
grant execute on function public.admin_archive_product(text) to authenticated;
