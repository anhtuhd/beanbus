create table public.loyalty_policy (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  earn_bps integer not null default 0 check (earn_bps between 0 and 10000),
  cod_eligible boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete restrict
);

insert into public.loyalty_policy (id, enabled, earn_bps, cod_eligible)
values (true, false, 0, false);

create table public.loyalty_policy_history (
  id bigint generated always as identity primary key,
  enabled boolean not null,
  earn_bps integer not null,
  cod_eligible boolean not null,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  order_id uuid references public.orders (id) on delete restrict,
  points integer not null check (points <> 0),
  amount_vnd integer not null default 0 check (amount_vnd >= 0),
  source_type text not null check (source_type in ('order_earned', 'order_reversal', 'redemption', 'manual_adjustment')),
  source_key text not null unique check (char_length(source_key) between 3 and 200),
  actor_user_id uuid references auth.users (id) on delete restrict,
  note text,
  created_at timestamptz not null default now()
);

create index loyalty_ledger_user_created_idx on public.loyalty_ledger (user_id, created_at desc);
create index loyalty_ledger_order_idx on public.loyalty_ledger (order_id);

alter table public.loyalty_policy enable row level security;
alter table public.loyalty_policy_history enable row level security;
alter table public.loyalty_ledger enable row level security;
revoke all on table public.loyalty_policy, public.loyalty_policy_history, public.loyalty_ledger from anon, authenticated;
grant select on table public.loyalty_ledger to authenticated;
grant all on table public.loyalty_policy, public.loyalty_policy_history, public.loyalty_ledger to service_role;

create policy "Members read their loyalty ledger"
on public.loyalty_ledger for select to authenticated
using ((select auth.uid()) = user_id or (select public.current_user_role()) = 'admin');

create policy "Admins read loyalty policy history"
on public.loyalty_policy_history for select to authenticated
using ((select public.current_user_role()) = 'admin');

create function public.get_member_loyalty_summary(p_user_id uuid)
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
  if p_user_id is null or ((select auth.uid()) is distinct from p_user_id and (select public.current_user_role()) is distinct from 'admin') then
    raise exception 'LOYALTY_FORBIDDEN';
  end if;

  return query
  select
    policy.enabled,
    coalesce(sum(ledger.points), 0)::bigint,
    coalesce(sum(ledger.points) filter (where ledger.points > 0), 0)::bigint,
    abs(coalesce(sum(ledger.points) filter (where ledger.points < 0), 0))::bigint,
    coalesce((select sum(orders.total_vnd) from public.orders where orders.user_id = p_user_id and orders.status = 'completed' and (orders.payment_status = 'paid' or orders.payment_method = 'cod')), 0)::bigint
  from public.loyalty_policy policy
  left join public.loyalty_ledger ledger on ledger.user_id = p_user_id
  where policy.id;
end;
$$;

create function public.update_loyalty_policy(
  p_enabled boolean,
  p_earn_bps integer,
  p_cod_eligible boolean
)
returns table (updated_enabled boolean, updated_earn_bps integer, updated_cod_eligible boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_policy public.loyalty_policy%rowtype;
begin
  if (select public.current_user_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_enabled is null or p_earn_bps is null or p_earn_bps not between 0 and 10000 or p_cod_eligible is null then raise exception 'INVALID_LOYALTY_POLICY'; end if;

  select * into v_policy from public.loyalty_policy where id for update;
  update public.loyalty_policy set enabled = p_enabled, earn_bps = p_earn_bps, cod_eligible = p_cod_eligible, updated_at = now(), updated_by = (select auth.uid()) where id;
  insert into public.loyalty_policy_history (enabled, earn_bps, cod_eligible, actor_user_id)
  values (p_enabled, p_earn_bps, p_cod_eligible, (select auth.uid()));
  return query select p_enabled, p_earn_bps, p_cod_eligible;
end;
$$;

create function public.apply_loyalty_for_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_policy public.loyalty_policy%rowtype;
  v_points integer;
  v_earned integer;
begin
  if new.user_id is null then return new; end if;
  select * into v_policy from public.loyalty_policy where id;
  if not found or not v_policy.enabled or v_policy.earn_bps = 0 then return new; end if;

  if new.status = 'completed'
    and (new.payment_status = 'paid' or (new.payment_method = 'cod' and v_policy.cod_eligible)) then
    v_points := floor((new.total_vnd::numeric * v_policy.earn_bps) / 10000)::integer;
    if v_points > 0 then
      insert into public.loyalty_ledger (user_id, order_id, points, amount_vnd, source_type, source_key, actor_user_id, note)
      values (new.user_id, new.id, v_points, new.total_vnd, 'order_earned', 'order:' || new.id::text || ':earned', (select auth.uid()), 'Server-earned order reward')
      on conflict (source_key) do nothing;
    end if;
  end if;

  if new.status = 'cancelled' or new.payment_status = 'refunded' then
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

create trigger orders_apply_loyalty
after insert or update of status, payment_status on public.orders
for each row execute function public.apply_loyalty_for_order();

revoke all on function public.get_member_loyalty_summary(uuid) from public;
grant execute on function public.get_member_loyalty_summary(uuid) to authenticated;
revoke all on function public.update_loyalty_policy(boolean, integer, boolean) from public;
grant execute on function public.update_loyalty_policy(boolean, integer, boolean) to authenticated;
revoke all on function public.apply_loyalty_for_order() from public;

create function public.get_loyalty_policy()
returns table (enabled boolean, earn_bps integer, cod_eligible boolean, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select loyalty_policy.enabled, loyalty_policy.earn_bps, loyalty_policy.cod_eligible, loyalty_policy.updated_at
  from public.loyalty_policy
  where loyalty_policy.id
    and (select public.current_user_role()) = 'admin'
$$;

revoke all on function public.get_loyalty_policy() from public;
grant execute on function public.get_loyalty_policy() to authenticated;
