begin;

-- Stored-value payments do not share the order-payment expiry worker. Keep the
-- cleanup bounded and service-only, then invoke it from authenticated server
-- reads so a disabled external scheduler cannot leave stale pending rows.
create or replace function public.expire_pending_stored_value_payments(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_expired integer := 0;
  v_now timestamptz := now();
  v_payment public.stored_value_payments%rowtype;
  v_campaign_id uuid;
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'INVALID_EXPIRY_LIMIT';
  end if;
  v_limit := p_limit;

  for v_payment in
    select payments.*
    from public.stored_value_payments as payments
    where payments.status = 'pending'
      and payments.expires_at <= v_now
    order by payments.expires_at, payments.id
    limit v_limit
    for update skip locked
  loop
    update public.stored_value_payments
    set status = 'expired', updated_at = v_now
    where id = v_payment.id and status = 'pending';
    if not found then continue; end if;
    v_expired := v_expired + 1;

    if v_payment.topup_id is not null then
      update public.wallet_topups
      set status = 'expired', updated_at = v_now
      where id = v_payment.topup_id and status = 'pending';
    else
      v_campaign_id := null;
      update public.flash_sale_purchases
      set status = 'expired', reservation_released = true, updated_at = v_now
      where id = v_payment.flash_sale_purchase_id
        and status = 'pending'
        and not reservation_released
      returning campaign_id into v_campaign_id;

      if v_campaign_id is not null then
        update public.flash_sale_campaigns
        set quota_reserved = greatest(quota_reserved - 1, 0), updated_at = v_now
        where id = v_campaign_id;
      else
        update public.flash_sale_purchases
        set status = 'expired', updated_at = v_now
        where id = v_payment.flash_sale_purchase_id and status = 'pending';
      end if;
    end if;
  end loop;

  return v_expired;
end;
$$;

revoke all on function public.expire_pending_stored_value_payments(integer) from public;
grant execute on function public.expire_pending_stored_value_payments(integer) to service_role;

-- Correct existing stale intents when this migration is deployed. Future reads
-- and payment creation paths invoke the same bounded cleanup function.
select public.expire_pending_stored_value_payments(100);

create or replace function public.get_stored_value_purchase(p_purchase_id uuid)
returns table (
  purchase_type text,
  purchase_id uuid,
  amount_vnd integer,
  points integer,
  purchase_status text,
  payment_status text,
  payment_code text,
  expires_at timestamptz,
  paid_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or p_purchase_id is null then return; end if;
  return query
  select 'topup'::text, topups.id, topups.amount_vnd, topups.points,
    case when coalesce(payments.status, topups.status) = 'pending'
      and coalesce(payments.expires_at, topups.expires_at) <= now() then 'expired'
      else topups.status end,
    case when payments.status = 'pending' and payments.expires_at <= now() then 'expired'
      else payments.status end,
    payments.payment_code, coalesce(payments.expires_at, topups.expires_at), topups.paid_at
  from public.wallet_topups topups
  left join public.stored_value_payments payments on payments.topup_id = topups.id
  where topups.id = p_purchase_id and topups.user_id = (select auth.uid());
  if found then return; end if;
  return query
  select 'flash_sale'::text, purchases.id, purchases.amount_vnd, purchases.points,
    case when coalesce(payments.status, purchases.status) = 'pending'
      and coalesce(payments.expires_at, purchases.expires_at) <= now() then 'expired'
      else purchases.status end,
    case when payments.status = 'pending' and payments.expires_at <= now() then 'expired'
      else payments.status end,
    payments.payment_code, coalesce(payments.expires_at, purchases.expires_at), purchases.paid_at
  from public.flash_sale_purchases purchases
  left join public.stored_value_payments payments on payments.flash_sale_purchase_id = purchases.id
  where purchases.id = p_purchase_id and purchases.user_id = (select auth.uid());
end;
$$;

create or replace function public.get_member_payment_history(
  p_page integer default 1,
  p_page_size integer default 20
)
returns table (
  source_type text,
  reference_id uuid,
  reference_code text,
  payment_code text,
  amount_vnd integer,
  points integer,
  status text,
  payment_method text,
  created_at timestamptz,
  paid_at timestamptz,
  expires_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with params as (
    select greatest(coalesce(p_page, 1), 1) as page,
      least(greatest(coalesce(p_page_size, 20), 1), 50) as page_size
  ), history as (
    select 'topup'::text as source_type,
      topups.id as reference_id,
      topups.id::text as reference_code,
      payments.payment_code,
      topups.amount_vnd,
      topups.points,
      case when coalesce(payments.status, topups.status) = 'pending'
        and coalesce(payments.expires_at, topups.expires_at) <= now() then 'expired'
        else coalesce(payments.status, topups.status) end as status,
      'sepay'::text as payment_method,
      topups.created_at,
      coalesce(payments.paid_at, topups.paid_at) as paid_at,
      coalesce(payments.expires_at, topups.expires_at) as expires_at
    from public.wallet_topups topups
    left join public.stored_value_payments payments on payments.topup_id = topups.id
    where topups.user_id = (select auth.uid())

    union all

    select 'flash_sale'::text,
      purchases.id,
      purchases.id::text,
      payments.payment_code,
      purchases.amount_vnd,
      purchases.points,
      case when coalesce(payments.status, purchases.status) = 'pending'
        and coalesce(payments.expires_at, purchases.expires_at) <= now() then 'expired'
        else coalesce(payments.status, purchases.status) end,
      'sepay'::text,
      purchases.created_at,
      coalesce(payments.paid_at, purchases.paid_at),
      coalesce(payments.expires_at, purchases.expires_at)
    from public.flash_sale_purchases purchases
    left join public.stored_value_payments payments on payments.flash_sale_purchase_id = purchases.id
    where purchases.user_id = (select auth.uid())

    union all

    select 'order'::text,
      orders.id,
      orders.order_code,
      payments.payment_code,
      payments.amount_vnd,
      orders.points_applied,
      payments.status,
      payments.provider,
      payments.created_at,
      payments.paid_at,
      payments.expires_at
    from public.payments payments
    join public.orders orders on orders.id = payments.order_id
    where orders.user_id = (select auth.uid())
  ), numbered as (
    select history.*, count(*) over () as total_count
    from history
  )
  select numbered.source_type, numbered.reference_id, numbered.reference_code,
    numbered.payment_code, numbered.amount_vnd, numbered.points, numbered.status,
    numbered.payment_method, numbered.created_at, numbered.paid_at,
    numbered.expires_at, numbered.total_count
  from numbered, params
  order by numbered.created_at desc, numbered.reference_id desc
  limit (select page_size from params)
  offset ((select page from params) - 1) * (select page_size from params);
$$;

revoke all on function public.get_stored_value_purchase(uuid) from public;
grant execute on function public.get_stored_value_purchase(uuid) to authenticated;
revoke all on function public.get_member_payment_history(integer, integer) from public;
grant execute on function public.get_member_payment_history(integer, integer) to authenticated;

commit;
