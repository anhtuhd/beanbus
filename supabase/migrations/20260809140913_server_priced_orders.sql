create type public.order_status as enum (
  'pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'
);
create type public.order_fulfillment as enum ('pickup', 'delivery');
create type public.order_payment_method as enum ('sepay_qr', 'cod');
create type public.order_payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.discount_type as enum ('percent', 'fixed');

create table public.vouchers (
  code text primary key check (code = upper(code)),
  discount_type public.discount_type not null,
  discount_value integer not null check (discount_value > 0),
  minimum_subtotal_vnd integer not null default 0 check (minimum_subtotal_vnd >= 0),
  maximum_discount_vnd integer check (maximum_discount_vnd > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer check (usage_limit > 0),
  usage_count integer not null default 0 check (usage_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_type <> 'percent' or discount_value <= 100),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  idempotency_key uuid not null unique,
  user_id uuid references auth.users (id) on delete set null,
  customer_name text not null check (char_length(customer_name) between 2 and 100),
  customer_phone text not null check (customer_phone ~ '^\+84[35789][0-9]{8}$'),
  fulfillment public.order_fulfillment not null,
  pickup_at timestamptz,
  delivery_address text,
  note text,
  voucher_code text references public.vouchers (code),
  subtotal_vnd integer not null default 0 check (subtotal_vnd >= 0),
  discount_vnd integer not null default 0 check (discount_vnd >= 0),
  total_vnd integer not null default 0 check (total_vnd >= 0),
  payment_method public.order_payment_method not null,
  payment_status public.order_payment_status not null default 'pending',
  status public.order_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_vnd <= subtotal_vnd),
  check (total_vnd = subtotal_vnd - discount_vnd),
  check (
    (fulfillment = 'pickup' and pickup_at is not null and delivery_address is null)
    or (fulfillment = 'delivery' and pickup_at is null and char_length(delivery_address) between 10 and 300)
  ),
  check (note is null or char_length(note) <= 500)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id text not null references public.products (id),
  product_name_vi text not null,
  product_name_en text not null,
  image_url text not null,
  quantity integer not null check (quantity between 1 and 20),
  base_price_vnd integer not null check (base_price_vnd >= 0),
  options_price_vnd integer not null default 0 check (options_price_vnd >= 0),
  unit_price_vnd integer not null check (unit_price_vnd >= 0),
  line_total_vnd integer not null check (line_total_vnd >= 0),
  special_note text check (special_note is null or char_length(special_note) <= 200),
  created_at timestamptz not null default now(),
  check (unit_price_vnd = base_price_vnd + options_price_vnd),
  check (line_total_vnd = unit_price_vnd * quantity)
);

create table public.order_item_options (
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  option_id text not null references public.catalog_options (id),
  option_name_vi text not null,
  option_name_en text not null,
  extra_price_vnd integer not null check (extra_price_vnd >= 0),
  primary key (order_item_id, option_id)
);

create index orders_user_created_idx on public.orders (user_id, created_at desc);
create index orders_phone_created_idx on public.orders (customer_phone, created_at desc);
create index order_items_order_idx on public.order_items (order_id);

alter table public.vouchers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_options enable row level security;

revoke all on table public.vouchers, public.orders, public.order_items, public.order_item_options
from anon, authenticated;
grant select on table public.orders, public.order_items, public.order_item_options to authenticated;
grant select, insert, update, delete on table public.vouchers to authenticated;
grant update (status, payment_status, updated_at) on table public.orders to authenticated;
grant all on table public.vouchers, public.orders, public.order_items, public.order_item_options to service_role;

create policy "Members read their orders"
on public.orders for select to authenticated
using ((select auth.uid()) = user_id or (select public.current_user_role()) = 'admin');

create policy "Members read their order items"
on public.order_items for select to authenticated
using (exists (
  select 1 from public.orders
  where orders.id = order_items.order_id
    and (orders.user_id = (select auth.uid()) or (select public.current_user_role()) = 'admin')
));

create policy "Members read their order item options"
on public.order_item_options for select to authenticated
using (exists (
  select 1 from public.order_items
  join public.orders on orders.id = order_items.order_id
  where order_items.id = order_item_options.order_item_id
    and (orders.user_id = (select auth.uid()) or (select public.current_user_role()) = 'admin')
));

create policy "Admins manage vouchers"
on public.vouchers for all to authenticated
using ((select public.current_user_role()) = 'admin')
with check ((select public.current_user_role()) = 'admin');

create policy "Admins update orders"
on public.orders for update to authenticated
using ((select public.current_user_role()) = 'admin')
with check ((select public.current_user_role()) = 'admin');

create trigger vouchers_set_updated_at before update on public.vouchers
for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();

insert into public.vouchers (
  code, discount_type, discount_value, minimum_subtotal_vnd, maximum_discount_vnd, usage_limit
) values
  ('BEANBUS10', 'percent', 10, 0, 50000, 1000),
  ('WELCOMEVIP', 'fixed', 20000, 50000, null, 500);

create function public.create_server_priced_order(
  p_idempotency_key uuid,
  p_customer_name text,
  p_customer_phone text,
  p_fulfillment public.order_fulfillment,
  p_pickup_at timestamptz,
  p_delivery_address text,
  p_note text,
  p_payment_method public.order_payment_method,
  p_voucher_code text,
  p_items jsonb
)
returns table (
  order_id uuid,
  order_number bigint,
  subtotal_vnd integer,
  discount_vnd integer,
  total_vnd integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_product public.products%rowtype;
  v_voucher public.vouchers%rowtype;
  v_item jsonb;
  v_item_id uuid;
  v_quantity integer;
  v_option_ids text[];
  v_option_count integer;
  v_options_price integer;
  v_line_total integer;
  v_subtotal integer := 0;
  v_discount integer := 0;
  v_code text := nullif(upper(trim(p_voucher_code)), '');
begin
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

  select * into v_order from public.orders where idempotency_key = p_idempotency_key;
  if found then
    if v_order.user_id is distinct from (select auth.uid()) then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return query select v_order.id, v_order.order_number, v_order.subtotal_vnd,
      v_order.discount_vnd, v_order.total_vnd;
    return;
  end if;

  if char_length(trim(p_customer_name)) not between 2 and 100
    or p_customer_phone !~ '^\+84[35789][0-9]{8}$' then
    raise exception 'INVALID_CUSTOMER';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'INVALID_ITEMS';
  end if;
  if p_fulfillment = 'pickup' and p_pickup_at is null then raise exception 'INVALID_PICKUP'; end if;
  if p_fulfillment = 'delivery' and char_length(trim(coalesce(p_delivery_address, ''))) not between 10 and 300 then
    raise exception 'INVALID_DELIVERY';
  end if;
  if char_length(coalesce(p_note, '')) > 500 then raise exception 'INVALID_NOTE'; end if;
  if (select count(*) from public.orders where customer_phone = p_customer_phone and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'RATE_LIMITED';
  end if;

  insert into public.orders (
    idempotency_key, user_id, customer_name, customer_phone, fulfillment, pickup_at,
    delivery_address, note, voucher_code, payment_method
  ) values (
    p_idempotency_key, (select auth.uid()), trim(p_customer_name), p_customer_phone, p_fulfillment,
    case when p_fulfillment = 'pickup' then p_pickup_at end,
    case when p_fulfillment = 'delivery' then trim(p_delivery_address) end,
    nullif(trim(p_note), ''), v_code, p_payment_method
  ) returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then raise exception 'INVALID_ITEM'; end if;
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity not between 1 and 20 then raise exception 'INVALID_QUANTITY'; end if;

    select * into v_product from public.products
    where id = v_item ->> 'productId' and is_published and is_available;
    if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;

    select coalesce(array_agg(value order by value), array[]::text[])
    into v_option_ids
    from jsonb_array_elements_text(coalesce(v_item -> 'optionIds', '[]'::jsonb));

    if cardinality(v_option_ids) <> cardinality(array(select distinct unnest(v_option_ids))) then
      raise exception 'DUPLICATE_OPTION';
    end if;

    select count(*)::integer, coalesce(sum(extra_price_vnd), 0)::integer
    into v_option_count, v_options_price
    from public.catalog_options
    where id = any(v_option_ids) and option_set_id = v_product.option_set_id and is_active;

    if v_option_count <> cardinality(v_option_ids) then raise exception 'INVALID_OPTION'; end if;
    if exists (
      select 1 from public.catalog_options
      where id = any(v_option_ids) and group_name in ('size', 'sugar', 'ice')
      group by group_name having count(*) > 1
    ) then raise exception 'CONFLICTING_OPTION'; end if;

    v_line_total := (v_product.price_vnd + v_options_price) * v_quantity;
    insert into public.order_items (
      order_id, product_id, product_name_vi, product_name_en, image_url, quantity,
      base_price_vnd, options_price_vnd, unit_price_vnd, line_total_vnd, special_note
    ) values (
      v_order.id, v_product.id, v_product.name_vi, v_product.name_en, v_product.image_url,
      v_quantity, v_product.price_vnd, v_options_price, v_product.price_vnd + v_options_price,
      v_line_total, nullif(trim(v_item ->> 'specialNote'), '')
    ) returning id into v_item_id;

    insert into public.order_item_options (
      order_item_id, option_id, option_name_vi, option_name_en, extra_price_vnd
    ) select v_item_id, id, name_vi, name_en, extra_price_vnd
      from public.catalog_options where id = any(v_option_ids);
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  if v_code is not null then
    select * into v_voucher from public.vouchers where code = v_code for update;
    if not found or not v_voucher.is_active
      or v_subtotal < v_voucher.minimum_subtotal_vnd
      or (v_voucher.starts_at is not null and now() < v_voucher.starts_at)
      or (v_voucher.ends_at is not null and now() >= v_voucher.ends_at)
      or (v_voucher.usage_limit is not null and v_voucher.usage_count >= v_voucher.usage_limit) then
      raise exception 'INVALID_VOUCHER';
    end if;
    v_discount := case when v_voucher.discount_type = 'percent'
      then round(v_subtotal * v_voucher.discount_value / 100.0)::integer
      else v_voucher.discount_value end;
    v_discount := least(v_subtotal, v_discount, coalesce(v_voucher.maximum_discount_vnd, v_discount));
    update public.vouchers set usage_count = usage_count + 1 where code = v_code;
  end if;

  update public.orders set subtotal_vnd = v_subtotal, discount_vnd = v_discount,
    total_vnd = v_subtotal - v_discount where id = v_order.id
  returning * into v_order;

  return query select v_order.id, v_order.order_number, v_order.subtotal_vnd,
    v_order.discount_vnd, v_order.total_vnd;
end;
$$;

revoke all on function public.create_server_priced_order(
  uuid, text, text, public.order_fulfillment, timestamptz, text, text,
  public.order_payment_method, text, jsonb
) from public;
grant execute on function public.create_server_priced_order(
  uuid, text, text, public.order_fulfillment, timestamptz, text, text,
  public.order_payment_method, text, jsonb
) to anon, authenticated;
