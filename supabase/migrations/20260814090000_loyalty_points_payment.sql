-- Beanbus points are a ledger-backed payment method. This migration is additive
-- and keeps the original order RPC as a zero-points compatibility wrapper.

create extension if not exists pgcrypto with schema extensions;

alter table public.orders
  add column if not exists points_applied integer not null default 0,
  add column if not exists cash_due_vnd integer not null default 0,
  add column if not exists request_fingerprint text;

update public.orders
set points_applied = coalesce(points_applied, 0),
    cash_due_vnd = greatest(total_vnd - coalesce(points_applied, 0), 0)
where cash_due_vnd = 0 and total_vnd > 0;

alter table public.orders
  drop constraint if exists orders_points_applied_check,
  drop constraint if exists orders_cash_due_check,
  drop constraint if exists orders_cash_due_consistency_check,
  add constraint orders_points_applied_check check (points_applied between 0 and total_vnd),
  add constraint orders_cash_due_check check (cash_due_vnd >= 0),
  add constraint orders_cash_due_consistency_check check (cash_due_vnd = total_vnd - points_applied);

create or replace function public.set_order_cash_due_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.points_applied is null then new.points_applied := 0; end if;
  if new.cash_due_vnd is null then new.cash_due_vnd := new.total_vnd; end if;
  -- The legacy pricing function updates total_vnd after inserting the shell row.
  if new.points_applied = 0 and new.cash_due_vnd = 0 and new.total_vnd > 0 then
    new.cash_due_vnd := new.total_vnd;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_set_points_cash_defaults on public.orders;
create trigger orders_set_points_cash_defaults
before insert or update of total_vnd, points_applied, cash_due_vnd on public.orders
for each row execute function public.set_order_cash_due_defaults();

alter table public.loyalty_policy
  add column if not exists points_payment_enabled boolean not null default false;
alter table public.loyalty_policy_history
  add column if not exists points_payment_enabled boolean not null default false;

alter table public.loyalty_ledger
  drop constraint if exists loyalty_ledger_source_type_check,
  add constraint loyalty_ledger_source_type_check check (source_type in (
    'order_earned', 'order_reversal', 'redemption', 'manual_adjustment',
    'topup_credited', 'flash_sale_credited', 'order_payment_debit', 'order_payment_refund'
  ));

create or replace function public.loyalty_wallet_lock_key(p_user_id uuid)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.hashtextextended('beanbus:loyalty-wallet:' || p_user_id::text, 0);
$$;

revoke all on function public.loyalty_wallet_lock_key(uuid) from public;

-- Every debit of a member's balance must obtain this lock first. Redemption
-- previously used only its idempotency key, allowing it to race checkout.
create or replace function public.redeem_loyalty_reward(p_reward_id text, p_idempotency_key uuid)
returns table (voucher_code text, points_spent integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_reward public.loyalty_rewards%rowtype;
  v_balance bigint;
  v_existing public.loyalty_ledger%rowtype;
  v_source_key text := 'redemption:' || p_idempotency_key::text;
  v_code text := 'REWARD-' || upper(substr(replace(p_idempotency_key::text, '-', ''), 1, 24));
begin
  if v_user_id is null or p_reward_id is null or p_reward_id !~ '^[a-z0-9][a-z0-9-]{2,79}$' or p_idempotency_key is null then
    raise exception 'INVALID_REDEMPTION';
  end if;

  perform pg_advisory_xact_lock(public.loyalty_wallet_lock_key(v_user_id));
  perform pg_advisory_xact_lock(pg_catalog.hashtextextended('loyalty-redemption:' || p_idempotency_key::text, 0));

  select * into v_existing from public.loyalty_ledger where source_key = v_source_key for update;
  if found then
    if v_existing.user_id is distinct from v_user_id then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return query select v_existing.voucher_code, abs(v_existing.points);
    return;
  end if;

  select * into v_reward from public.loyalty_rewards where id = p_reward_id and is_active for update;
  if not found then raise exception 'REWARD_NOT_FOUND'; end if;
  if not exists (select 1 from public.loyalty_policy where id and enabled) then raise exception 'LOYALTY_DISABLED'; end if;
  select coalesce(sum(points), 0)::bigint into v_balance from public.loyalty_ledger where user_id = v_user_id;
  if v_balance < v_reward.points_cost then raise exception 'INSUFFICIENT_POINTS'; end if;

  insert into public.vouchers (code, discount_type, discount_value, minimum_subtotal_vnd, maximum_discount_vnd, usage_limit, is_active, assigned_user_id)
  values (v_code, v_reward.discount_type, v_reward.discount_value, v_reward.minimum_subtotal_vnd, v_reward.maximum_discount_vnd, 1, true, v_user_id);
  insert into public.loyalty_ledger (user_id, points, amount_vnd, source_type, source_key, actor_user_id, voucher_code, note)
  values (v_user_id, -v_reward.points_cost, 0, 'redemption', v_source_key, v_user_id, v_code, 'Reward redemption');
  return query select v_code, v_reward.points_cost;
end;
$$;

revoke all on function public.redeem_loyalty_reward(text, uuid) from public;
grant execute on function public.redeem_loyalty_reward(text, uuid) to authenticated;

create or replace function public.get_points_payment_policy()
returns table (enabled boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select loyalty_policy.points_payment_enabled
  from public.loyalty_policy
  where loyalty_policy.id;
$$;

create or replace function public.update_points_payment_policy(p_enabled boolean)
returns table (updated_enabled boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select public.current_user_role()) is distinct from 'admin' then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if p_enabled is null then raise exception 'INVALID_POINTS_POLICY'; end if;
  update public.loyalty_policy
  set points_payment_enabled = p_enabled, updated_at = now(), updated_by = (select auth.uid())
  where id;
  if not found then raise exception 'LOYALTY_POLICY_NOT_FOUND'; end if;
  insert into public.loyalty_policy_history (
    enabled, earn_bps, cod_eligible, points_payment_enabled, actor_user_id
  )
  select enabled, earn_bps, cod_eligible, points_payment_enabled, (select auth.uid())
  from public.loyalty_policy where id;
  return query select p_enabled;
end;
$$;

revoke all on function public.get_points_payment_policy() from public;
revoke all on function public.update_points_payment_policy(boolean) from public;
grant execute on function public.get_points_payment_policy() to anon, authenticated;
grant execute on function public.update_points_payment_policy(boolean) to authenticated;

-- Rename the old implementation so the public signature can become a wrapper.
alter function public.create_server_priced_order(
  uuid, text, text, public.order_fulfillment, timestamptz, text, text,
  public.order_payment_method, text, jsonb
) rename to create_server_priced_order_legacy;

create function public.create_server_priced_order_v2(
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
  v_user_id uuid := (select auth.uid());
  v_order public.orders%rowtype;
  v_legacy record;
  v_fingerprint text;
  v_available bigint;
  v_points integer := coalesce(p_points_to_apply, 0);
begin
  if p_idempotency_key is null or v_points < 0 then raise exception 'INVALID_POINTS_PAYMENT'; end if;
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
      'pointsToApply', v_points
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

  if v_points > 0 then
    if v_user_id is null then raise exception 'POINTS_AUTH_REQUIRED'; end if;
    if not exists (select 1 from public.loyalty_policy where id and points_payment_enabled) then
      raise exception 'POINTS_PAYMENT_DISABLED';
    end if;
  end if;

  -- This call remains server-priced and runs in the same transaction.
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
      payment_status = case when v_order.total_vnd - v_points = 0 then 'paid' else payment_status end
  where id = v_order.id
  returning * into v_order;

  if v_points > 0 then
    insert into public.loyalty_ledger (
      user_id, order_id, points, amount_vnd, source_type, source_key, actor_user_id, note
    ) values (
      v_user_id, v_order.id, -v_points, v_points, 'order_payment_debit',
      'order:' || v_order.id::text || ':points_debit', v_user_id, 'Điểm dùng thanh toán đơn hàng'
    ) on conflict (source_key) do nothing;
  end if;

  return query select v_order.id, v_order.order_number, v_order.subtotal_vnd, v_order.discount_vnd,
    v_order.total_vnd, v_order.points_applied, v_order.cash_due_vnd, v_order.receipt_token, v_fingerprint;
end;
$$;

revoke all on function public.create_server_priced_order_v2(
  uuid, text, text, public.order_fulfillment, timestamptz, text, text,
  public.order_payment_method, text, jsonb, integer
) from public;
grant execute on function public.create_server_priced_order_v2(
  uuid, text, text, public.order_fulfillment, timestamptz, text, text,
  public.order_payment_method, text, jsonb, integer
) to anon, authenticated;

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
language sql
security definer
set search_path = ''
as $$
  select order_id, order_number, subtotal_vnd, discount_vnd, total_vnd
  from public.create_server_priced_order_v2(
    p_idempotency_key, p_customer_name, p_customer_phone, p_fulfillment, p_pickup_at,
    p_delivery_address, p_note, p_payment_method, p_voucher_code, p_items, 0
  );
$$;

revoke all on function public.create_server_priced_order_legacy(
  uuid, text, text, public.order_fulfillment, timestamptz, text, text,
  public.order_payment_method, text, jsonb
) from public, anon, authenticated;
revoke all on function public.create_server_priced_order(
  uuid, text, text, public.order_fulfillment, timestamptz, text, text,
  public.order_payment_method, text, jsonb
) from public;
grant execute on function public.create_server_priced_order(
  uuid, text, text, public.order_fulfillment, timestamptz, text, text,
  public.order_payment_method, text, jsonb
) to anon, authenticated;

drop function if exists public.get_member_loyalty_summary_v2(uuid);
create function public.get_member_loyalty_summary_v2(p_user_id uuid)
returns table (
  policy_enabled boolean,
  points_payment_enabled boolean,
  balance_points bigint,
  available_points bigint,
  debt_points bigint,
  topup_points bigint,
  earned_points bigint,
  spent_points bigint,
  total_spent_vnd bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or ((select auth.uid()) is distinct from p_user_id and (select public.current_user_role()) is distinct from 'admin') then
    raise exception 'LOYALTY_FORBIDDEN';
  end if;
  return query
  select policy.enabled,
    policy.points_payment_enabled,
    coalesce(sum(ledger.points), 0)::bigint,
    greatest(coalesce(sum(ledger.points), 0), 0)::bigint,
    greatest(-coalesce(sum(ledger.points), 0), 0)::bigint,
    coalesce(sum(ledger.points) filter (where ledger.source_type = 'topup_credited' and ledger.points > 0), 0)::bigint,
    coalesce(sum(ledger.points) filter (where ledger.source_type = 'order_earned' and ledger.points > 0), 0)::bigint,
    abs(coalesce(sum(ledger.points) filter (where ledger.points < 0), 0))::bigint,
    coalesce((select sum(orders.cash_due_vnd) from public.orders where orders.user_id = p_user_id and orders.status = 'completed' and (orders.payment_status = 'paid' or orders.payment_method = 'cod')), 0)::bigint
  from public.loyalty_policy policy
  left join public.loyalty_ledger ledger on ledger.user_id = p_user_id
  where policy.id
  group by policy.id, policy.enabled, policy.points_payment_enabled;
end;
$$;

revoke all on function public.get_member_loyalty_summary_v2(uuid) from public;
grant execute on function public.get_member_loyalty_summary_v2(uuid) to authenticated;

create function public.get_admin_member_point_balances(p_user_ids uuid[])
returns table (
  user_id uuid,
  balance_points bigint,
  available_points bigint,
  debt_points bigint,
  topup_points bigint,
  earned_points bigint,
  spent_points bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select public.current_user_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_user_ids is null or cardinality(p_user_ids) > 100 then raise exception 'INVALID_MEMBER_BATCH'; end if;
  return query
  select ids.user_id,
    coalesce(sum(ledger.points), 0)::bigint,
    greatest(coalesce(sum(ledger.points), 0), 0)::bigint,
    greatest(-coalesce(sum(ledger.points), 0), 0)::bigint,
    coalesce(sum(ledger.points) filter (where ledger.source_type = 'topup_credited' and ledger.points > 0), 0)::bigint,
    coalesce(sum(ledger.points) filter (where ledger.source_type = 'order_earned' and ledger.points > 0), 0)::bigint,
    abs(coalesce(sum(ledger.points) filter (where ledger.points < 0), 0))::bigint
  from (select distinct input.user_id from unnest(p_user_ids) as input(user_id)) as ids
  left join public.loyalty_ledger ledger on ledger.user_id = ids.user_id
  group by ids.user_id;
end;
$$;

revoke all on function public.get_admin_member_point_balances(uuid[]) from public;
grant execute on function public.get_admin_member_point_balances(uuid[]) to authenticated;

create function public.admin_adjust_member_points(
  p_user_id uuid,
  p_delta integer,
  p_reason text,
  p_idempotency_key uuid
)
returns table (
  adjusted_user_id uuid,
  applied_delta integer,
  balance_points bigint,
  available_points bigint,
  debt_points bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_existing public.loyalty_ledger%rowtype;
  v_balance bigint;
begin
  if (select public.current_user_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_user_id is null or p_delta is null or p_delta = 0 or abs(p_delta) > 10000000 or p_idempotency_key is null then
    raise exception 'INVALID_POINTS_ADJUSTMENT';
  end if;
  if p_reason is null or char_length(trim(p_reason)) not between 10 and 300 then raise exception 'INVALID_POINTS_REASON'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id and role = 'member') then raise exception 'MEMBER_REQUIRED'; end if;

  perform pg_advisory_xact_lock(public.loyalty_wallet_lock_key(p_user_id));
  select * into v_existing from public.loyalty_ledger
  where source_key = 'manual:' || p_idempotency_key::text;
  if found then
    if v_existing.user_id <> p_user_id or v_existing.points <> p_delta or v_existing.note <> trim(p_reason) or v_existing.actor_user_id <> v_actor then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
  else
    select coalesce(sum(points), 0)::bigint into v_balance from public.loyalty_ledger where user_id = p_user_id;
    if p_delta < 0 and v_balance + p_delta < 0 then raise exception 'INSUFFICIENT_POINTS'; end if;
    insert into public.loyalty_ledger (user_id, points, amount_vnd, source_type, source_key, actor_user_id, note)
    values (p_user_id, p_delta, 0, 'manual_adjustment', 'manual:' || p_idempotency_key::text, v_actor, trim(p_reason));
  end if;

  select coalesce(sum(points), 0)::bigint into v_balance from public.loyalty_ledger where user_id = p_user_id;
  return query select p_user_id, p_delta, v_balance, greatest(v_balance, 0), greatest(-v_balance, 0);
end;
$$;

revoke all on function public.admin_adjust_member_points(uuid, integer, text, uuid) from public;
grant execute on function public.admin_adjust_member_points(uuid, integer, text, uuid) to authenticated;

create function public.compensate_order_payment_failure(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_user_id uuid;
begin
  select user_id into v_user_id from public.orders where id = p_order_id;
  if v_user_id is not null then perform pg_advisory_xact_lock(public.loyalty_wallet_lock_key(v_user_id)); end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then return false; end if;
  if v_order.status = 'pending' and v_order.payment_status = 'pending' then
    update public.orders set status = 'cancelled', payment_status = 'failed', updated_at = now() where id = p_order_id;
    return true;
  end if;
  return false;
end;
$$;

revoke all on function public.compensate_order_payment_failure(uuid) from public, anon, authenticated;
grant execute on function public.compensate_order_payment_failure(uuid) to service_role;

alter table public.order_refund_history alter column payment_id drop not null;
create unique index if not exists order_refund_history_points_only_idx
on public.order_refund_history (order_id) where payment_id is null;

create or replace function public.apply_loyalty_for_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_policy public.loyalty_policy%rowtype;
  v_points integer;
  v_earned integer;
  v_reverse_on_cancel boolean := true;
  v_reverse_on_refund boolean := true;
begin
  if new.user_id is null then return new; end if;
  select * into v_policy from public.loyalty_policy where id;
  select loyalty_reverse_on_cancel, loyalty_reverse_on_refund
  into v_reverse_on_cancel, v_reverse_on_refund from public.commerce_policy where id;

  if v_policy.id and v_policy.enabled and v_policy.earn_bps > 0
    and new.status = 'completed'
    and new.cash_due_vnd > 0
    and (new.payment_status = 'paid' or (new.payment_method = 'cod' and v_policy.cod_eligible)) then
    v_points := floor((new.cash_due_vnd::numeric * v_policy.earn_bps) / 10000)::integer;
    if v_points > 0 then
      insert into public.loyalty_ledger (user_id, order_id, points, amount_vnd, source_type, source_key, actor_user_id, note)
      values (new.user_id, new.id, v_points, new.cash_due_vnd, 'order_earned', 'order:' || new.id::text || ':earned', (select auth.uid()), 'Server-earned order reward')
      on conflict (source_key) do nothing;
    end if;
  end if;

  if (new.status = 'cancelled' and coalesce(v_reverse_on_cancel, true))
    or (new.payment_status in ('failed', 'refunded') and coalesce(v_reverse_on_refund, true)) then
    select coalesce(sum(points), 0)::integer into v_earned
    from public.loyalty_ledger where order_id = new.id and source_type = 'order_earned' and points > 0;
    if v_earned > 0 then
      insert into public.loyalty_ledger (user_id, order_id, points, amount_vnd, source_type, source_key, actor_user_id, note)
      values (new.user_id, new.id, -v_earned, 0, 'order_reversal', 'order:' || new.id::text || ':reversed', (select auth.uid()), 'Automatic reversal after cancellation or refund')
      on conflict (source_key) do nothing;
    end if;
  end if;

  if new.points_applied > 0 and (new.status = 'cancelled' or new.payment_status in ('failed', 'refunded')) then
    insert into public.loyalty_ledger (user_id, order_id, points, amount_vnd, source_type, source_key, actor_user_id, note)
    values (new.user_id, new.id, new.points_applied, new.points_applied, 'order_payment_refund', 'order:' || new.id::text || ':points_refund', (select auth.uid()), 'Hoàn điểm thanh toán đơn hàng')
    on conflict (source_key) do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.sync_voucher_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.voucher_reservations%rowtype;
  v_cancel_mode text := 'release';
  v_refund_mode text := 'release';
  v_release boolean;
begin
  if tg_op = 'INSERT' then
    if new.voucher_code is not null then
      insert into public.voucher_reservations (order_id, voucher_code)
      values (new.id, new.voucher_code) on conflict (order_id) do nothing;
    end if;
    return new;
  end if;
  select voucher_on_cancel, voucher_on_refund into v_cancel_mode, v_refund_mode from public.commerce_policy where id;
  select * into v_reservation from public.voucher_reservations where order_id = new.id for update;
  if not found then return new; end if;

  if (new.payment_status = 'paid' or (new.payment_method = 'cod' and new.status = 'completed'))
    and v_reservation.status = 'reserved' then
    update public.voucher_reservations set status = 'consumed', consumed_at = coalesce(consumed_at, now()), updated_at = now() where order_id = new.id;
    return new;
  end if;

  if new.payment_status = 'refunded' then v_release := coalesce(v_refund_mode, 'release') = 'release';
  elsif new.status = 'cancelled' then v_release := coalesce(v_cancel_mode, 'release') = 'release';
  elsif new.payment_status = 'failed' then v_release := true;
  else return new;
  end if;

  if v_release and v_reservation.status in ('reserved', 'consumed') then
    update public.voucher_reservations set status = 'released', released_at = coalesce(released_at, now()), updated_at = now() where order_id = new.id;
    update public.vouchers set usage_count = greatest(usage_count - 1, 0), updated_at = now() where code = v_reservation.voucher_code;
  elsif not v_release and v_reservation.status = 'reserved' then
    update public.voucher_reservations set status = 'consumed', consumed_at = coalesce(consumed_at, now()), updated_at = now() where order_id = new.id;
  end if;
  return new;
end;
$$;

alter table public.voucher_reservations
  drop constraint if exists voucher_reservations_consumed_at_check,
  drop constraint if exists voucher_reservations_released_at_check,
  drop constraint if exists voucher_reservations_check,
  add constraint voucher_reservations_consumed_state_check check (status <> 'consumed' or consumed_at is not null),
  add constraint voucher_reservations_released_state_check check (status <> 'released' or released_at is not null);

-- Point changes are visible in the same notification center as orders. Ledger
-- rows remain the audit source; this trigger only creates the user-facing copy.
alter table public.notifications
  drop constraint if exists notifications_kind_check,
  drop constraint if exists notifications_source_type_check,
  add constraint notifications_kind_check check (kind in (
    'order_created', 'order_status_changed', 'order_payment_changed',
    'event_published', 'store_announcement', 'booking_request_created',
    'booking_request_status_changed', 'customer_request_created',
    'customer_request_status_changed', 'points_adjusted'
  )),
  add constraint notifications_source_type_check check (source_type in (
    'order', 'event', 'store_announcement', 'booking_request',
    'customer_request', 'loyalty'
  ));

create or replace function public.notify_loyalty_ledger_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source_type not in ('manual_adjustment', 'topup_credited', 'order_payment_refund') then
    return new;
  end if;

  perform public.enqueue_user_notification(
    new.user_id,
    'points_adjusted',
    case when new.points > 0 then 'Điểm Beanbus đã được cộng' else 'Điểm Beanbus đã được sử dụng' end,
    case when new.points > 0 then 'Beanbus points added' else 'Beanbus points used' end,
    format('%s điểm%s.', abs(new.points), case when new.note is null then '' else ' - ' || new.note end),
    format('%s points%s.', abs(new.points), case when new.note is null then '' else ' - ' || new.note end),
    '/account?tab=membership',
    'loyalty',
    new.id::text,
    'loyalty:' || new.id::text,
    'order',
    false
  );
  return new;
end;
$$;

revoke all on function public.notify_loyalty_ledger_entry() from public, anon, authenticated;
drop trigger if exists loyalty_ledger_create_notification on public.loyalty_ledger;
create trigger loyalty_ledger_create_notification
after insert on public.loyalty_ledger
for each row execute function public.notify_loyalty_ledger_entry();

-- Do not notify from the zero-priced shell row created by the legacy server
-- pricing function. The final update has request_fingerprint and cash_due.
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
  return new;
end;
$$;

revoke all on function public.notify_new_order() from public, anon, authenticated;
drop trigger if exists orders_create_notifications on public.orders;
create trigger orders_create_notifications
after insert or update of subtotal_vnd, discount_vnd, total_vnd, points_applied, cash_due_vnd on public.orders
for each row execute function public.notify_new_order();

create function public.refund_order_settlement(p_order_id uuid)
returns table (refunded_order_id uuid, cash_refunded_vnd integer, points_restored integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_policy public.commerce_policy%rowtype;
  v_payment public.payments%rowtype;
  v_user_id uuid;
  v_cash integer := 0;
begin
  if (select public.current_user_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_order_id is null then raise exception 'INVALID_REFUND'; end if;
  select user_id into v_user_id from public.orders where id = p_order_id;
  if v_user_id is not null then perform pg_advisory_xact_lock(public.loyalty_wallet_lock_key(v_user_id)); end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  select * into v_policy from public.commerce_policy where id for update;
  if not found or not v_policy.refund_enabled then raise exception 'REFUNDS_DISABLED'; end if;
  if v_order.created_at < now() - make_interval(hours => v_policy.refund_window_hours) then raise exception 'REFUND_WINDOW_EXPIRED'; end if;
  if v_order.payment_status <> 'paid'
    and not (v_order.payment_method = 'cod' and v_order.status = 'completed') then
    raise exception 'REFUND_NOT_ELIGIBLE';
  end if;

  if v_order.payment_method = 'sepay_qr' and v_order.cash_due_vnd > 0 then
    select * into v_payment from public.payments where order_id = p_order_id for update;
    if not found or v_payment.status <> 'paid' then raise exception 'PAYMENT_NOT_ELIGIBLE'; end if;
    v_cash := v_payment.amount_vnd;
    update public.payments set status = 'refunded' where id = v_payment.id and status = 'paid';
    insert into public.order_refund_history (order_id, payment_id, amount_vnd, actor_user_id)
    values (v_order.id, v_payment.id, v_cash, (select auth.uid()))
    on conflict (order_id, payment_id) do nothing;
  elsif v_order.payment_method = 'cod' and v_order.cash_due_vnd > 0 then
    v_cash := v_order.cash_due_vnd;
    insert into public.order_refund_history (order_id, payment_id, amount_vnd, actor_user_id)
    values (v_order.id, null, v_cash, (select auth.uid()))
    on conflict do nothing;
  end if;

  update public.orders
  set status = 'cancelled', payment_status = 'refunded', updated_at = now()
  where id = v_order.id
    and payment_status <> 'refunded';
  return query select v_order.id, v_cash, v_order.points_applied;
end;
$$;

create or replace function public.update_order_status(
  p_order_id uuid,
  p_status public.order_status
)
returns table (
  updated_order_id uuid,
  updated_order_status public.order_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_transition text;
begin
  if (select public.current_user_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_order_id is null or p_status is null then raise exception 'INVALID_ORDER_STATUS'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status = p_status then
    return query select v_order.id, v_order.status;
    return;
  end if;
  if v_order.payment_status in ('failed', 'refunded') then raise exception 'ORDER_SETTLEMENT_FINALIZED'; end if;
  if v_order.payment_method = 'sepay_qr'
    and v_order.payment_status <> 'paid'
    and v_order.status = 'pending'
    and p_status = 'confirmed' then
    raise exception 'PAYMENT_REQUIRED';
  end if;
  if v_order.payment_status = 'paid' and p_status = 'cancelled' then raise exception 'REFUND_REQUIRED'; end if;

  v_transition := v_order.status::text || ':' || p_status::text;
  if v_transition not in (
    'pending:confirmed', 'pending:cancelled', 'confirmed:preparing', 'confirmed:cancelled',
    'preparing:ready', 'preparing:cancelled', 'ready:completed', 'ready:cancelled'
  ) then raise exception 'INVALID_ORDER_TRANSITION'; end if;

  update public.orders
  set status = p_status,
      payment_status = case
        when p_status = 'completed' and v_order.payment_method = 'cod' then 'paid'::public.order_payment_status
        else v_order.payment_status
      end
  where id = v_order.id;
  return query select v_order.id, p_status;
end;
$$;

drop function if exists public.refund_order_payment(uuid);
create function public.refund_order_payment(p_order_id uuid)
returns table (refunded_order_id uuid, refunded_amount_vnd integer)
language sql
security definer
set search_path = ''
as $$
  select refunded_order_id, cash_refunded_vnd from public.refund_order_settlement(p_order_id);
$$;

revoke all on function public.refund_order_settlement(uuid) from public;
revoke all on function public.refund_order_payment(uuid) from public;
grant execute on function public.refund_order_settlement(uuid) to authenticated;
grant execute on function public.refund_order_payment(uuid) to authenticated;

create or replace function public.create_sepay_payment(
  p_order_id uuid, p_receipt_token uuid, p_bank_code text, p_account_number text
)
returns table (payment_id uuid, payment_code text, amount_vnd integer, payment_status text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.orders%rowtype; v_payment public.payments%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id and receipt_token = p_receipt_token for update;
  if not found or v_order.payment_method <> 'sepay_qr' or v_order.status <> 'pending' or v_order.payment_status <> 'pending' or v_order.cash_due_vnd <= 0 then raise exception 'ORDER_NOT_ELIGIBLE'; end if;
  if char_length(trim(p_bank_code)) not between 2 and 32 or char_length(trim(p_account_number)) not between 4 and 64 then raise exception 'INVALID_PAYMENT_DESTINATION'; end if;
  insert into public.payments (order_id, payment_code, amount_vnd, bank_code, account_number, expires_at)
  values (v_order.id, v_order.order_code, v_order.cash_due_vnd, trim(p_bank_code), trim(p_account_number), now() + interval '15 minutes')
  on conflict (order_id) do nothing;
  select * into strict v_payment from public.payments where order_id = v_order.id;
  return query select v_payment.id, v_payment.payment_code, v_payment.amount_vnd, v_payment.status, v_payment.expires_at;
end;
$$;

-- A late SePay webhook must never turn a cancelled/failed order back into paid.
create or replace function public.process_sepay_webhook(
  p_provider_transaction_id bigint, p_gateway text, p_transaction_at timestamptz,
  p_account_number text, p_code text, p_transfer_type text, p_transfer_amount integer,
  p_reference_code text, p_payload jsonb
)
returns table (outcome text, matched_order_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_payment_id uuid;
  v_order_id uuid;
  v_inserted integer;
  v_order public.orders%rowtype;
  v_existing_status text;
  v_existing_payment_id uuid;
  v_existing_reason text;
  v_existing_order_id uuid;
begin
  if p_gateway is null or char_length(trim(p_gateway)) not between 1 and 100 or p_payload is null then
    raise exception 'INVALID_WEBHOOK_EVENT';
  end if;
  insert into public.sepay_webhook_events (provider_transaction_id, payload) values (p_provider_transaction_id, p_payload) on conflict (provider_transaction_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    select events.status, events.payment_id, events.reason, payments.order_id
    into v_existing_status, v_existing_payment_id, v_existing_reason, v_existing_order_id
    from public.sepay_webhook_events as events
    left join public.payments as payments on payments.id = events.payment_id
    where events.provider_transaction_id = p_provider_transaction_id
    for update of events;
    if v_existing_status = 'rejected'
      and v_existing_payment_id is null
      and v_existing_reason = 'PAYMENT_NOT_FOUND' then
      update public.sepay_webhook_events
      set payload = p_payload, status = 'received', reason = null, processed_at = null
      where provider_transaction_id = p_provider_transaction_id;
    else
      return query select 'duplicate'::text, v_existing_order_id;
      return;
    end if;
  end if;
  if p_transfer_type <> 'in' then
    update public.sepay_webhook_events set status = 'rejected', reason = 'NOT_INBOUND', processed_at = now() where provider_transaction_id = p_provider_transaction_id;
    return query select 'rejected'::text, null::uuid; return;
  end if;
  select payments.id, payments.order_id into v_payment_id, v_order_id
  from public.payments
  where payment_code = upper(p_code);
  if not found then
    update public.sepay_webhook_events set status = 'rejected', reason = 'PAYMENT_NOT_FOUND', processed_at = now() where provider_transaction_id = p_provider_transaction_id;
    return query select 'rejected'::text, null::uuid; return;
  end if;
  select * into v_order from public.orders where id = v_order_id for update;
  select * into v_payment from public.payments where id = v_payment_id for update;
  update public.sepay_webhook_events set payment_id = v_payment.id where provider_transaction_id = p_provider_transaction_id;
  if v_order.status = 'cancelled' or v_order.payment_status <> 'pending' then
    update public.sepay_webhook_events set status = 'rejected', reason = 'ORDER_NOT_PENDING', processed_at = now() where provider_transaction_id = p_provider_transaction_id;
    return query select 'rejected'::text, v_payment.order_id; return;
  end if;
  if p_account_number <> v_payment.account_number then
    update public.sepay_webhook_events set status = 'rejected', reason = 'ACCOUNT_MISMATCH', processed_at = now() where provider_transaction_id = p_provider_transaction_id;
    return query select 'rejected'::text, v_payment.order_id; return;
  end if;
  if p_transfer_amount <> v_payment.amount_vnd then
    update public.sepay_webhook_events set status = 'rejected', reason = 'AMOUNT_MISMATCH', processed_at = now() where provider_transaction_id = p_provider_transaction_id;
    return query select 'rejected'::text, v_payment.order_id; return;
  end if;
  if p_transaction_at < v_payment.created_at - interval '5 minutes' or p_transaction_at > v_payment.expires_at then
    update public.payments set status = 'expired' where id = v_payment.id and status = 'pending';
    update public.sepay_webhook_events set status = 'rejected', reason = 'PAYMENT_EXPIRED', processed_at = now() where provider_transaction_id = p_provider_transaction_id;
    return query select 'rejected'::text, v_payment.order_id; return;
  end if;
  if v_payment.status <> 'pending' then
    update public.sepay_webhook_events set status = 'rejected', reason = 'PAYMENT_NOT_PENDING', processed_at = now() where provider_transaction_id = p_provider_transaction_id;
    return query select 'rejected'::text, v_payment.order_id; return;
  end if;
  update public.payments set status = 'paid', provider_transaction_id = p_provider_transaction_id, provider_reference = nullif(trim(p_reference_code), ''), provider_payload = p_payload, paid_at = p_transaction_at where id = v_payment.id;
  update public.orders set payment_status = 'paid', status = case when status = 'pending' then 'confirmed' else status end where id = v_payment.order_id;
  update public.sepay_webhook_events set status = 'processed', processed_at = now() where provider_transaction_id = p_provider_transaction_id;
  return query select 'processed'::text, v_payment.order_id;
end;
$$;

create or replace function public.expire_pending_sepay_payments()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_expired integer; v_abandoned integer;
begin
  update public.payments set status = 'expired', updated_at = now() where status = 'pending' and expires_at <= now();
  get diagnostics v_expired = row_count;

  update public.orders as orders
  set status = 'cancelled', payment_status = 'failed', updated_at = now()
  where orders.payment_method = 'sepay_qr'
    and orders.cash_due_vnd > 0
    and orders.payment_status in ('pending', 'failed')
    and orders.status = 'pending'
    and exists (
      select 1 from public.payments as payment
      where payment.order_id = orders.id
        and payment.status = 'expired'
        and payment.expires_at <= now()
    );

  update public.orders as orders
  set status = 'cancelled', payment_status = 'failed', updated_at = now()
  where orders.payment_method = 'sepay_qr'
    and orders.cash_due_vnd > 0
    and orders.payment_status in ('pending', 'failed')
    and orders.status = 'pending'
    and not exists (select 1 from public.payments as payment where payment.order_id = orders.id)
    and orders.created_at <= now() - interval '15 minutes';
  get diagnostics v_abandoned = row_count;
  return v_expired + v_abandoned;
end;
$$;

-- Reconciliation is a second payment ingress, so it must enforce the same
-- cancelled-order and cash-due guards as the webhook path.
create or replace function public.process_sepay_reconciliation(
  p_provider_transaction_key text,
  p_gateway text,
  p_transaction_at timestamptz,
  p_account_number text,
  p_code text,
  p_transfer_type text,
  p_transfer_amount integer,
  p_reference_code text,
  p_content text,
  p_payload jsonb
)
returns table (outcome text, matched_order_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_payment_id uuid;
  v_order_id uuid;
  v_order public.orders%rowtype;
  v_inserted integer;
  v_existing_order_id uuid;
begin
  if p_provider_transaction_key is null
    or char_length(trim(p_provider_transaction_key)) not between 1 and 128
    or p_gateway is null
    or char_length(trim(p_gateway)) not between 1 and 100
    or p_transaction_at is null
    or p_account_number is null
    or char_length(trim(p_account_number)) not between 4 and 64
    or p_code is null
    or char_length(trim(p_code)) not between 1 and 64
    or p_transfer_amount is null
    or p_transfer_amount < 1
    or p_content is null
    or char_length(trim(p_content)) not between 1 and 2000
    or p_payload is null then
    raise exception 'INVALID_RECONCILIATION_EVENT';
  end if;

  insert into public.sepay_reconciliation_events (provider_transaction_key, payload)
  values (trim(p_provider_transaction_key), p_payload)
  on conflict (provider_transaction_key) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select payments.order_id into v_existing_order_id
    from public.sepay_reconciliation_events as events
    left join public.payments on payments.id = events.payment_id
    where events.provider_transaction_key = trim(p_provider_transaction_key);
    return query select 'duplicate'::text, v_existing_order_id;
    return;
  end if;

  if p_transfer_type <> 'in' then
    update public.sepay_reconciliation_events
    set status = 'rejected', reason = 'NOT_INBOUND', processed_at = now()
    where provider_transaction_key = trim(p_provider_transaction_key);
    return query select 'rejected'::text, null::uuid;
    return;
  end if;

  select payments.id, payments.order_id into v_payment_id, v_order_id
  from public.payments
  where payment_code = upper(trim(p_code))
  ;
  if not found then
    update public.sepay_reconciliation_events
    set status = 'rejected', reason = 'PAYMENT_NOT_FOUND', processed_at = now()
    where provider_transaction_key = trim(p_provider_transaction_key);
    return query select 'rejected'::text, null::uuid;
    return;
  end if;

  select * into v_order from public.orders where id = v_order_id for update;
  select * into v_payment from public.payments where id = v_payment_id for update;
  update public.sepay_reconciliation_events
  set payment_id = v_payment.id
  where provider_transaction_key = trim(p_provider_transaction_key);
  if v_order.status = 'cancelled' or v_order.payment_status <> 'pending' or v_order.cash_due_vnd <> v_payment.amount_vnd then
    update public.sepay_reconciliation_events
    set status = 'rejected', reason = 'ORDER_NOT_PENDING', processed_at = now()
    where provider_transaction_key = trim(p_provider_transaction_key);
    return query select 'rejected'::text, v_payment.order_id;
    return;
  end if;
  if p_account_number <> v_payment.account_number then
    update public.sepay_reconciliation_events
    set status = 'rejected', reason = 'ACCOUNT_MISMATCH', processed_at = now()
    where provider_transaction_key = trim(p_provider_transaction_key);
    return query select 'rejected'::text, v_payment.order_id;
    return;
  end if;
  if p_transfer_amount <> v_payment.amount_vnd then
    update public.sepay_reconciliation_events
    set status = 'rejected', reason = 'AMOUNT_MISMATCH', processed_at = now()
    where provider_transaction_key = trim(p_provider_transaction_key);
    return query select 'rejected'::text, v_payment.order_id;
    return;
  end if;
  if p_transaction_at < v_payment.created_at - interval '5 minutes'
    or p_transaction_at > v_payment.expires_at then
    update public.payments set status = 'expired' where id = v_payment.id and status = 'pending';
    update public.sepay_reconciliation_events
    set status = 'rejected', reason = 'PAYMENT_EXPIRED', processed_at = now()
    where provider_transaction_key = trim(p_provider_transaction_key);
    return query select 'rejected'::text, v_payment.order_id;
    return;
  end if;
  if v_payment.status <> 'pending' then
    update public.sepay_reconciliation_events
    set status = 'rejected', reason = 'PAYMENT_NOT_PENDING', processed_at = now()
    where provider_transaction_key = trim(p_provider_transaction_key);
    return query select 'rejected'::text, v_payment.order_id;
    return;
  end if;

  update public.payments
  set status = 'paid',
    provider_transaction_key = trim(p_provider_transaction_key),
    provider_reference = nullif(trim(p_reference_code), ''),
    provider_payload = p_payload,
    paid_at = p_transaction_at
  where id = v_payment.id;

  update public.orders
  set payment_status = 'paid',
    status = case when status = 'pending' then 'confirmed' else status end
  where id = v_payment.order_id;

  update public.sepay_reconciliation_events
  set status = 'processed', processed_at = now()
  where provider_transaction_key = trim(p_provider_transaction_key);

  return query select 'processed'::text, v_payment.order_id;
end;
$$;

revoke all on function public.process_sepay_reconciliation(text, text, timestamptz, text, text, text, integer, text, text, jsonb) from public;
grant execute on function public.process_sepay_reconciliation(text, text, timestamptz, text, text, text, integer, text, text, jsonb) to service_role;

create or replace function public.get_order_receipt(p_order_id uuid, p_receipt_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', orders.id, 'number', orders.order_number, 'orderCode', orders.order_code,
    'customerName', orders.customer_name, 'customerPhone', orders.customer_phone,
    'fulfillment', orders.fulfillment, 'pickupAt', orders.pickup_at, 'deliveryAddress', orders.delivery_address,
    'note', orders.note, 'subtotalVnd', orders.subtotal_vnd, 'discountVnd', orders.discount_vnd,
    'totalVnd', orders.total_vnd, 'pointsApplied', orders.points_applied, 'cashDueVnd', orders.cash_due_vnd,
    'paymentMethod', orders.payment_method, 'paymentStatus', orders.payment_status, 'status', orders.status,
    'createdAt', orders.created_at,
    'payment', (select jsonb_build_object('code', payments.payment_code, 'status', payments.status, 'expiresAt', payments.expires_at, 'bankCode', payments.bank_code, 'accountNumber', payments.account_number) from public.payments where payments.order_id = orders.id),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', order_items.id, 'productId', order_items.product_id, 'nameVi', order_items.product_name_vi, 'nameEn', order_items.product_name_en, 'imageUrl', order_items.image_url, 'quantity', order_items.quantity, 'unitPriceVnd', order_items.unit_price_vnd, 'lineTotalVnd', order_items.line_total_vnd, 'specialNote', order_items.special_note, 'options', coalesce((select jsonb_agg(jsonb_build_object('id', order_item_options.option_id, 'nameVi', order_item_options.option_name_vi, 'nameEn', order_item_options.option_name_en, 'extraPriceVnd', order_item_options.extra_price_vnd) order by order_item_options.option_id) from public.order_item_options where order_item_options.order_item_id = order_items.id), '[]'::jsonb)) order by order_items.created_at, order_items.id) from public.order_items where order_items.order_id = orders.id), '[]'::jsonb)
  ) from public.orders where orders.id = p_order_id and orders.receipt_token = p_receipt_token;
$$;

-- Allow consumed voucher reservations to be released by a configured refund policy.
comment on column public.voucher_reservations.consumed_at is 'Kept as historical evidence when a consumed voucher is later released.';
