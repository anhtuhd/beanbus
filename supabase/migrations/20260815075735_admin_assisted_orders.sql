alter table public.orders
  add column if not exists created_via text not null default 'customer_web',
  add column if not exists created_by_user_id uuid references auth.users (id) on delete set null;

alter table public.orders
  drop constraint if exists orders_created_via_check,
  drop constraint if exists orders_created_by_check;

alter table public.orders
  add constraint orders_created_via_check check (created_via in ('customer_web', 'admin_panel', 'pos')),
  add constraint orders_created_by_check check (
    (created_via in ('admin_panel', 'pos') and created_by_user_id is not null)
    or (created_via = 'customer_web' and created_by_user_id is null)
  );

create index if not exists orders_created_by_user_idx
on public.orders (created_by_user_id, created_at desc)
where created_by_user_id is not null;

create table if not exists public.admin_order_creation_audit (
  order_id uuid primary key references public.orders (id) on delete cascade,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  target_user_id uuid references auth.users (id) on delete set null,
  points_consent_confirmed boolean not null default false,
  points_consent_note text,
  voucher_consent_confirmed boolean not null default false,
  voucher_consent_note text,
  created_at timestamptz not null default now(),
  check (points_consent_note is null or char_length(points_consent_note) between 10 and 300),
  check (points_consent_confirmed or points_consent_note is null),
  check (voucher_consent_note is null or char_length(voucher_consent_note) between 10 and 300),
  check (voucher_consent_confirmed or voucher_consent_note is null)
);

alter table public.admin_order_creation_audit enable row level security;
revoke all on table public.admin_order_creation_audit from anon, authenticated;
grant select on table public.admin_order_creation_audit to authenticated;
grant all on table public.admin_order_creation_audit to service_role;

create policy "Admins read admin order creation audit"
on public.admin_order_creation_audit for select to authenticated
using ((select public.current_user_role()) = 'admin');

create or replace function public.create_server_priced_order_legacy(
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
  v_creation_mode text := coalesce(nullif(current_setting('beanbus.order_creation_mode', true), ''), 'customer_web');
  v_admin_mode boolean := v_creation_mode in ('admin_panel', 'pos');
  v_user_id uuid := case
    when v_admin_mode then nullif(current_setting('beanbus.order_target_user_id', true), '')::uuid
    else (select auth.uid())
  end;
  v_actor_id uuid := case when v_admin_mode then (select auth.uid()) end;
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
    if v_order.user_id is distinct from v_user_id then
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
  if not v_admin_mode and (select count(*) from public.orders where customer_phone = p_customer_phone and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'RATE_LIMITED';
  end if;

  insert into public.orders (
    idempotency_key, user_id, customer_name, customer_phone, fulfillment, pickup_at,
    delivery_address, note, voucher_code, payment_method, created_via, created_by_user_id
  ) values (
    p_idempotency_key, v_user_id, trim(p_customer_name), p_customer_phone, p_fulfillment,
    case when p_fulfillment = 'pickup' then p_pickup_at end,
    case when p_fulfillment = 'delivery' then trim(p_delivery_address) end,
    nullif(trim(p_note), ''), v_code, p_payment_method,
    case when v_admin_mode then v_creation_mode else 'customer_web' end,
    v_actor_id
  ) returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then raise exception 'INVALID_ITEM'; end if;
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity not between 1 and 20 then raise exception 'INVALID_QUANTITY'; end if;

    select * into v_product from public.products
    where id = v_item ->> 'productId' and is_published and is_available
      and public.product_is_orderable(id);
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
    if v_voucher.assigned_user_id is not null and v_voucher.assigned_user_id is distinct from v_user_id then
      raise exception 'VOUCHER_NOT_OWNED';
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

create or replace function public.create_server_priced_order_v2(
  p_idempotency_key uuid,
  p_customer_name text,
  p_customer_phone text,
  p_fulfillment public.order_fulfillment,
  p_pickup_at timestamptz,
  p_delivery_address text,
  p_note text,
  p_payment_method public.order_payment_method,
  p_voucher_code text,
  p_items jsonb,
  p_points_to_apply integer
)
returns table (
  order_id uuid,
  order_number bigint,
  subtotal_vnd integer,
  discount_vnd integer,
  total_vnd integer,
  points_applied integer,
  cash_due_vnd integer,
  receipt_token uuid,
  request_fingerprint text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_mode boolean := current_setting('beanbus.order_creation_mode', true) = 'admin_panel';
  v_user_id uuid := case
    when v_admin_mode then nullif(current_setting('beanbus.order_target_user_id', true), '')::uuid
    else (select auth.uid())
  end;
  v_actor_id uuid := (select auth.uid());
  v_order public.orders%rowtype;
  v_legacy record;
  v_fingerprint text;
  v_available bigint;
  v_points integer := coalesce(p_points_to_apply, 0);
  v_consent boolean := current_setting('beanbus.order_points_consent', true) = 'true';
  v_consent_note text := nullif(current_setting('beanbus.order_points_consent_note', true), '');
begin
  if p_idempotency_key is null or v_points < 0 then raise exception 'INVALID_POINTS_PAYMENT'; end if;
  if v_admin_mode and (select public.current_user_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if v_admin_mode and v_user_id is not null and not exists (
    select 1 from public.profiles where id = v_user_id and role = 'member'
  ) then raise exception 'TARGET_MEMBER_REQUIRED'; end if;
  if v_admin_mode and v_points > 0 and (not v_consent or char_length(v_consent_note) not between 10 and 300) then
    raise exception 'POINTS_CONSENT_REQUIRED';
  end if;
  if v_points > 0 and v_user_id is null then raise exception 'POINTS_AUTH_REQUIRED'; end if;
  if v_user_id is not null then
    perform pg_advisory_xact_lock(public.loyalty_wallet_lock_key(v_user_id));
  end if;
  perform pg_advisory_xact_lock(pg_catalog.hashtextextended('beanbus:order-idempotency:' || p_idempotency_key::text, 0));

  v_fingerprint := encode(extensions.digest(
    jsonb_build_object(
      'customerName', trim(p_customer_name),
      'customerPhone', p_customer_phone,
      'fulfillment', p_fulfillment::text,
      'pickupAt', p_pickup_at,
      'deliveryAddress', nullif(trim(p_delivery_address), ''),
      'note', nullif(trim(p_note), ''),
      'paymentMethod', p_payment_method::text,
      'voucherCode', nullif(upper(trim(p_voucher_code)), ''),
      'items', p_items,
      'pointsToApply', v_points,
      'targetUserId', v_user_id,
      'creationMode', case when v_admin_mode then 'admin_panel' else 'customer_web' end
    )::text, 'sha256'
  ), 'hex');

  select * into v_order from public.orders where idempotency_key = p_idempotency_key for update;
  if found then
    if v_order.user_id is distinct from v_user_id
      or v_order.request_fingerprint is distinct from v_fingerprint
      or coalesce(v_order.points_applied, 0) <> v_points then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return query select v_order.id, v_order.order_number, v_order.subtotal_vnd, v_order.discount_vnd,
      v_order.total_vnd, v_order.points_applied, v_order.cash_due_vnd, v_order.receipt_token, v_fingerprint;
    return;
  end if;

  if v_points > 0 and not exists (select 1 from public.loyalty_policy where id and points_payment_enabled) then
    raise exception 'POINTS_PAYMENT_DISABLED';
  end if;

  perform pg_catalog.set_config('beanbus.server_priced_order_v2', 'true', true);
  select * into v_legacy from public.create_server_priced_order_legacy(
    p_idempotency_key, p_customer_name, p_customer_phone, p_fulfillment, p_pickup_at,
    p_delivery_address, p_note, p_payment_method, p_voucher_code, p_items
  );
  select * into v_order from public.orders where id = v_legacy.order_id for update;

  if v_points > v_order.total_vnd then raise exception 'POINTS_EXCEED_ORDER_TOTAL'; end if;
  if v_points > 0 then
    select greatest(coalesce(sum(points), 0), 0)::bigint into v_available
    from public.loyalty_ledger where user_id = v_user_id;
    if v_available < v_points then raise exception 'INSUFFICIENT_POINTS'; end if;
  end if;

  update public.orders
  set points_applied = v_points,
      cash_due_vnd = v_order.total_vnd - v_points,
      request_fingerprint = v_fingerprint,
      payment_status = case when v_order.total_vnd - v_points = 0 then 'paid' else payment_status end,
      status = case when v_admin_mode and (p_payment_method = 'cod' or v_order.total_vnd - v_points = 0) then 'confirmed' else status end
  where id = v_order.id
  returning * into v_order;

  if v_points > 0 then
    insert into public.loyalty_ledger (
      user_id, order_id, points, amount_vnd, source_type, source_key, actor_user_id, note
    ) values (
      v_user_id, v_order.id, -v_points, v_points, 'order_payment_debit',
      'order:' || v_order.id::text || ':points_debit', v_actor_id,
      case when v_admin_mode then 'Admin tạo đơn hộ, đã xác nhận đồng ý dùng điểm: ' || v_consent_note else 'Điểm dùng thanh toán đơn hàng' end
    ) on conflict (source_key) do nothing;
  end if;

  return query select v_order.id, v_order.order_number, v_order.subtotal_vnd, v_order.discount_vnd,
    v_order.total_vnd, v_order.points_applied, v_order.cash_due_vnd, v_order.receipt_token, v_fingerprint;
end;
$$;

create function public.admin_create_server_priced_order(
  p_idempotency_key uuid,
  p_target_member_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_fulfillment public.order_fulfillment,
  p_pickup_at timestamptz,
  p_delivery_address text,
  p_note text,
  p_payment_method public.order_payment_method,
  p_voucher_code text,
  p_items jsonb,
  p_points_to_apply integer,
  p_points_consent_confirmed boolean,
  p_points_consent_note text
)
returns table (
  order_id uuid,
  order_number bigint,
  subtotal_vnd integer,
  discount_vnd integer,
  total_vnd integer,
  points_applied integer,
  cash_due_vnd integer,
  receipt_token uuid,
  status public.order_status,
  payment_status public.order_payment_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result record;
  v_admin_id uuid := (select auth.uid());
begin
  if (select public.current_user_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_target_member_id is not null and not exists (
    select 1 from public.profiles where id = p_target_member_id and role = 'member'
  ) then raise exception 'TARGET_MEMBER_REQUIRED'; end if;
  if coalesce(p_points_to_apply, 0) > 0 and (not coalesce(p_points_consent_confirmed, false)
    or char_length(trim(coalesce(p_points_consent_note, ''))) not between 10 and 300) then
    raise exception 'POINTS_CONSENT_REQUIRED';
  end if;
  if coalesce(p_points_to_apply, 0) = 0 and p_points_consent_note is not null then
    raise exception 'INVALID_POINTS_CONSENT';
  end if;

  perform pg_catalog.set_config('beanbus.order_creation_mode', 'admin_panel', true);
  perform pg_catalog.set_config('beanbus.order_target_user_id', coalesce(p_target_member_id::text, ''), true);
  perform pg_catalog.set_config('beanbus.order_points_consent', case when coalesce(p_points_consent_confirmed, false) then 'true' else 'false' end, true);
  perform pg_catalog.set_config('beanbus.order_points_consent_note', trim(coalesce(p_points_consent_note, '')), true);

  select * into v_result from public.create_server_priced_order_v2(
    p_idempotency_key, p_customer_name, p_customer_phone, p_fulfillment, p_pickup_at,
    p_delivery_address, p_note, p_payment_method, p_voucher_code, p_items, coalesce(p_points_to_apply, 0)
  );

  insert into public.admin_order_creation_audit (
    order_id, actor_user_id, target_user_id, points_consent_confirmed, points_consent_note
  ) values (
    v_result.order_id, v_admin_id, p_target_member_id,
    coalesce(p_points_consent_confirmed, false),
    case when coalesce(p_points_to_apply, 0) > 0 then trim(p_points_consent_note) end
  ) on conflict on constraint admin_order_creation_audit_pkey do nothing;

  return query
  select v_result.order_id, v_result.order_number, v_result.subtotal_vnd, v_result.discount_vnd,
    v_result.total_vnd, v_result.points_applied, v_result.cash_due_vnd, v_result.receipt_token,
    orders.status, orders.payment_status
  from public.orders where orders.id = v_result.order_id;
end;
$$;

revoke all on function public.admin_create_server_priced_order(
  uuid, uuid, text, text, public.order_fulfillment, timestamptz, text, text,
  public.order_payment_method, text, jsonb, integer, boolean, text
) from public, anon;
grant execute on function public.admin_create_server_priced_order(
  uuid, uuid, text, text, public.order_fulfillment, timestamptz, text, text,
  public.order_payment_method, text, jsonb, integer, boolean, text
) to authenticated;

-- An admin-created order should not notify the admin who initiated it. Keep
-- the notification for every other admin, including guest orders.
create or replace function public.notify_new_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.total_vnd = 0 and new.cash_due_vnd = 0 then return new; end if;
  if new.request_fingerprint is null
    and coalesce(current_setting('beanbus.server_priced_order_v2', true), '') = 'true' then
    return new;
  end if;

  perform public.enqueue_role_notifications(
    'admin',
    'order_created',
    'Có đơn hàng mới',
    'New order received',
    case when new.points_applied > 0
      then format('Đơn %s từ %s, còn thanh toán %sđ (đã dùng %s điểm).', new.order_code, new.customer_name, to_char(new.cash_due_vnd, 'FM999G999G999'), to_char(new.points_applied, 'FM999G999G999'))
      else format('Đơn %s từ %s, tổng %sđ.', new.order_code, new.customer_name, to_char(new.total_vnd, 'FM999G999G999')) end,
    case when new.points_applied > 0
      then format('Order %s from %s, cash due %s VND (%s points applied).', new.order_code, new.customer_name, to_char(new.cash_due_vnd, 'FM999G999G999'), to_char(new.points_applied, 'FM999G999G999'))
      else format('Order %s from %s, total %s VND.', new.order_code, new.customer_name, to_char(new.total_vnd, 'FM999G999G999')) end,
    '/admin/orders/' || new.id::text,
    'order',
    new.id::text,
    'order_created:' || new.id::text,
    'order',
    true
  );

  if new.created_by_user_id is not null then
    delete from public.notifications
    where recipient_user_id = new.created_by_user_id
      and source_type = 'order'
      and source_id = new.id::text
      and dedupe_key = 'order_created:' || new.id::text;
  end if;

  return new;
end;
$$;

revoke all on function public.notify_new_order() from public, anon, authenticated;
