create table public.commerce_policy (
  id boolean primary key default true check (id),
  refund_enabled boolean not null default true,
  refund_window_hours integer not null default 48 check (refund_window_hours between 1 and 720),
  voucher_on_cancel text not null default 'release' check (voucher_on_cancel in ('release', 'consume')),
  voucher_on_refund text not null default 'release' check (voucher_on_refund in ('release', 'consume')),
  loyalty_reverse_on_cancel boolean not null default true,
  loyalty_reverse_on_refund boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete restrict
);

insert into public.commerce_policy (id)
values (true);

create table public.commerce_policy_history (
  id bigint generated always as identity primary key,
  refund_enabled boolean not null,
  refund_window_hours integer not null,
  voucher_on_cancel text not null,
  voucher_on_refund text not null,
  loyalty_reverse_on_cancel boolean not null,
  loyalty_reverse_on_refund boolean not null,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.order_refund_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete restrict,
  payment_id uuid not null references public.payments (id) on delete restrict,
  amount_vnd integer not null check (amount_vnd > 0),
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (order_id, payment_id)
);

alter table public.commerce_policy enable row level security;
alter table public.commerce_policy_history enable row level security;
alter table public.order_refund_history enable row level security;
revoke all on table public.commerce_policy, public.commerce_policy_history, public.order_refund_history from anon, authenticated;
grant all on table public.commerce_policy, public.commerce_policy_history, public.order_refund_history to service_role;
grant select on table public.commerce_policy_history, public.order_refund_history to authenticated;

create policy "Admins read commerce policy history"
on public.commerce_policy_history for select to authenticated
using ((select public.current_user_role()) = 'admin');

create policy "Admins read order refund history"
on public.order_refund_history for select to authenticated
using ((select public.current_user_role()) = 'admin');

create function public.get_commerce_policy()
returns table (
  refund_enabled boolean,
  refund_window_hours integer,
  voucher_on_cancel text,
  voucher_on_refund text,
  loyalty_reverse_on_cancel boolean,
  loyalty_reverse_on_refund boolean,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    commerce_policy.refund_enabled,
    commerce_policy.refund_window_hours,
    commerce_policy.voucher_on_cancel,
    commerce_policy.voucher_on_refund,
    commerce_policy.loyalty_reverse_on_cancel,
    commerce_policy.loyalty_reverse_on_refund,
    commerce_policy.updated_at
  from public.commerce_policy
  where commerce_policy.id
    and (select public.current_user_role()) = 'admin'
$$;

create function public.update_commerce_policy(
  p_refund_enabled boolean,
  p_refund_window_hours integer,
  p_voucher_on_cancel text,
  p_voucher_on_refund text,
  p_loyalty_reverse_on_cancel boolean,
  p_loyalty_reverse_on_refund boolean
)
returns table (
  updated_refund_enabled boolean,
  updated_refund_window_hours integer,
  updated_voucher_on_cancel text,
  updated_voucher_on_refund text,
  updated_loyalty_reverse_on_cancel boolean,
  updated_loyalty_reverse_on_refund boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select public.current_user_role()) is distinct from 'admin' then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if p_refund_enabled is null
    or p_refund_window_hours is null
    or p_refund_window_hours not between 1 and 720
    or p_voucher_on_cancel not in ('release', 'consume')
    or p_voucher_on_refund not in ('release', 'consume')
    or p_loyalty_reverse_on_cancel is null
    or p_loyalty_reverse_on_refund is null then
    raise exception 'INVALID_COMMERCE_POLICY';
  end if;

  perform 1 from public.commerce_policy where id for update;
  if not found then raise exception 'COMMERCE_POLICY_NOT_FOUND'; end if;

  update public.commerce_policy
  set refund_enabled = p_refund_enabled,
    refund_window_hours = p_refund_window_hours,
    voucher_on_cancel = p_voucher_on_cancel,
    voucher_on_refund = p_voucher_on_refund,
    loyalty_reverse_on_cancel = p_loyalty_reverse_on_cancel,
    loyalty_reverse_on_refund = p_loyalty_reverse_on_refund,
    updated_at = now(),
    updated_by = (select auth.uid())
  where id;

  insert into public.commerce_policy_history (
    refund_enabled,
    refund_window_hours,
    voucher_on_cancel,
    voucher_on_refund,
    loyalty_reverse_on_cancel,
    loyalty_reverse_on_refund,
    actor_user_id
  ) values (
    p_refund_enabled,
    p_refund_window_hours,
    p_voucher_on_cancel,
    p_voucher_on_refund,
    p_loyalty_reverse_on_cancel,
    p_loyalty_reverse_on_refund,
    (select auth.uid())
  );

  return query select
    p_refund_enabled,
    p_refund_window_hours,
    p_voucher_on_cancel,
    p_voucher_on_refund,
    p_loyalty_reverse_on_cancel,
    p_loyalty_reverse_on_refund;
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
      values (new.id, new.voucher_code)
      on conflict (order_id) do nothing;
    end if;
    return new;
  end if;

  select voucher_on_cancel, voucher_on_refund
  into v_cancel_mode, v_refund_mode
  from public.commerce_policy
  where id;

  select * into v_reservation
  from public.voucher_reservations
  where order_id = new.id
  for update;
  if not found or v_reservation.status <> 'reserved' then return new; end if;

  if new.payment_status = 'paid'
    or (new.payment_method = 'cod' and new.status = 'completed') then
    update public.voucher_reservations
    set status = 'consumed', consumed_at = coalesce(consumed_at, now()), updated_at = now()
    where order_id = new.id and status = 'reserved';
    return new;
  end if;

  if new.payment_status = 'refunded' then
    v_release := coalesce(v_refund_mode, 'release') = 'release';
  elsif new.status = 'cancelled' then
    v_release := coalesce(v_cancel_mode, 'release') = 'release';
  elsif new.payment_status = 'failed' then
    v_release := true;
  else
    return new;
  end if;

  if v_release then
    update public.voucher_reservations
    set status = 'released', released_at = coalesce(released_at, now()), updated_at = now()
    where order_id = new.id and status = 'reserved';

    update public.vouchers
    set usage_count = greatest(usage_count - 1, 0), updated_at = now()
    where code = v_reservation.voucher_code;
  else
    update public.voucher_reservations
    set status = 'consumed', consumed_at = coalesce(consumed_at, now()), updated_at = now()
    where order_id = new.id and status = 'reserved';
  end if;
  return new;
end;
$$;

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
  into v_reverse_on_cancel, v_reverse_on_refund
  from public.commerce_policy
  where id;

  if v_policy.id and v_policy.enabled and v_policy.earn_bps > 0
    and new.status = 'completed'
    and (new.payment_status = 'paid' or (new.payment_method = 'cod' and v_policy.cod_eligible)) then
    v_points := floor((new.total_vnd::numeric * v_policy.earn_bps) / 10000)::integer;
    if v_points > 0 then
      insert into public.loyalty_ledger (user_id, order_id, points, amount_vnd, source_type, source_key, actor_user_id, note)
      values (new.user_id, new.id, v_points, new.total_vnd, 'order_earned', 'order:' || new.id::text || ':earned', (select auth.uid()), 'Server-earned order reward')
      on conflict (source_key) do nothing;
    end if;
  end if;

  if (new.status = 'cancelled' and coalesce(v_reverse_on_cancel, true))
    or (new.payment_status = 'refunded' and coalesce(v_reverse_on_refund, true)) then
    select coalesce(sum(points), 0)::integer into v_earned
    from public.loyalty_ledger
    where order_id = new.id and source_type = 'order_earned' and points > 0;
    if v_earned > 0 then
      insert into public.loyalty_ledger (user_id, order_id, points, amount_vnd, source_type, source_key, actor_user_id, note)
      values (new.user_id, new.id, -v_earned, 0, 'order_reversal', 'order:' || new.id::text || ':reversed', (select auth.uid()), 'Automatic reversal after cancellation or refund')
      on conflict (source_key) do nothing;
    end if;
  end if;
  return new;
end;
$$;

create function public.refund_order_payment(p_order_id uuid)
returns table (refunded_order_id uuid, refunded_amount_vnd integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_policy public.commerce_policy%rowtype;
  v_payment public.payments%rowtype;
begin
  if (select public.current_user_role()) is distinct from 'admin' then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if p_order_id is null then raise exception 'INVALID_REFUND'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  select * into v_policy from public.commerce_policy where id for update;
  if not found or not v_policy.refund_enabled then raise exception 'REFUNDS_DISABLED'; end if;
  if v_order.created_at < now() - make_interval(hours => v_policy.refund_window_hours) then
    raise exception 'REFUND_WINDOW_EXPIRED';
  end if;
  if v_order.payment_method <> 'sepay_qr' or v_order.payment_status <> 'paid' then
    raise exception 'REFUND_NOT_ELIGIBLE';
  end if;

  select * into v_payment from public.payments where order_id = p_order_id for update;
  if not found or v_payment.status <> 'paid' then raise exception 'PAYMENT_NOT_ELIGIBLE'; end if;

  update public.payments
  set status = 'refunded'
  where id = v_payment.id and status = 'paid';

  insert into public.order_refund_history (order_id, payment_id, amount_vnd, actor_user_id)
  values (v_order.id, v_payment.id, v_payment.amount_vnd, (select auth.uid()))
  on conflict (order_id, payment_id) do nothing;

  return query select v_order.id, v_payment.amount_vnd;
end;
$$;

revoke all on function public.get_commerce_policy() from public;
revoke all on function public.update_commerce_policy(boolean, integer, text, text, boolean, boolean) from public;
revoke all on function public.refund_order_payment(uuid) from public;
grant execute on function public.get_commerce_policy() to authenticated;
grant execute on function public.update_commerce_policy(boolean, integer, text, text, boolean, boolean) to authenticated;
grant execute on function public.refund_order_payment(uuid) to authenticated;

revoke all on function public.sync_voucher_reservation() from public;
revoke all on function public.apply_loyalty_for_order() from public;
