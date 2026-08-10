alter table public.vouchers
  add column assigned_user_id uuid references auth.users (id) on delete cascade;

alter table public.loyalty_ledger
  add column voucher_code text references public.vouchers (code) on delete restrict;

drop policy if exists "Members read active vouchers" on public.vouchers;
create policy "Members read active vouchers"
on public.vouchers for select to authenticated
using (
  is_active
  and (assigned_user_id is null or assigned_user_id = (select auth.uid()))
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
);

create index vouchers_assigned_user_idx on public.vouchers (assigned_user_id, ends_at);

create table public.loyalty_rewards (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  name_vi text not null check (char_length(name_vi) between 3 and 180),
  name_en text not null check (char_length(name_en) between 3 and 180),
  points_cost integer not null check (points_cost > 0),
  discount_type public.discount_type not null,
  discount_value integer not null check (discount_value > 0),
  minimum_subtotal_vnd integer not null default 0 check (minimum_subtotal_vnd >= 0),
  maximum_discount_vnd integer check (maximum_discount_vnd is null or maximum_discount_vnd > 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_type <> 'percent' or discount_value <= 100),
  check (discount_type <> 'fixed' or maximum_discount_vnd is null)
);

create table public.loyalty_reward_change_history (
  id bigint generated always as identity primary key,
  reward_id text not null,
  operation text not null check (operation in ('created', 'updated')),
  before_data jsonb,
  after_data jsonb not null,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.loyalty_rewards enable row level security;
alter table public.loyalty_reward_change_history enable row level security;
revoke all on table public.loyalty_rewards, public.loyalty_reward_change_history from anon, authenticated;
grant select on table public.loyalty_rewards to authenticated;
grant select on table public.loyalty_reward_change_history to authenticated;
grant all on table public.loyalty_rewards, public.loyalty_reward_change_history to service_role;

create policy "Members read active loyalty rewards"
on public.loyalty_rewards for select to authenticated using (is_active);
create policy "Admins read loyalty reward history"
on public.loyalty_reward_change_history for select to authenticated
using ((select public.current_user_role()) = 'admin');

create trigger loyalty_rewards_set_updated_at
before update on public.loyalty_rewards
for each row execute function public.set_updated_at();

create function public.admin_upsert_loyalty_reward(
  p_reward_id text,
  p_name_vi text,
  p_name_en text,
  p_points_cost integer,
  p_discount_type public.discount_type,
  p_discount_value integer,
  p_minimum_subtotal_vnd integer,
  p_maximum_discount_vnd integer,
  p_is_active boolean
)
returns table (updated_reward_id text, operation text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reward public.loyalty_rewards%rowtype;
  v_id text := nullif(trim(p_reward_id), '');
  v_before jsonb;
  v_after jsonb;
  v_operation text;
begin
  if (select public.current_user_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if v_id is null or v_id !~ '^[a-z0-9][a-z0-9-]{2,79}$'
    or p_name_vi is null or char_length(trim(p_name_vi)) not between 3 and 180
    or p_name_en is null or char_length(trim(p_name_en)) not between 3 and 180
    or p_points_cost is null or p_points_cost <= 0
    or p_discount_type is null or p_discount_value is null or p_discount_value <= 0
    or p_minimum_subtotal_vnd is null or p_minimum_subtotal_vnd < 0
    or (p_maximum_discount_vnd is not null and p_maximum_discount_vnd <= 0)
    or p_is_active is null then raise exception 'INVALID_LOYALTY_REWARD'; end if;
  if p_discount_type = 'percent' and p_discount_value > 100 then raise exception 'INVALID_LOYALTY_REWARD_PERCENT'; end if;
  if p_discount_type = 'fixed' and p_maximum_discount_vnd is not null then raise exception 'INVALID_LOYALTY_REWARD_CAP'; end if;

  select * into v_reward from public.loyalty_rewards where id = v_id for update;
  if found then v_before := to_jsonb(v_reward); end if;
  insert into public.loyalty_rewards (id, name_vi, name_en, points_cost, discount_type, discount_value, minimum_subtotal_vnd, maximum_discount_vnd, is_active)
  values (v_id, trim(p_name_vi), trim(p_name_en), p_points_cost, p_discount_type, p_discount_value, p_minimum_subtotal_vnd, p_maximum_discount_vnd, p_is_active)
  on conflict (id) do update set
    name_vi = excluded.name_vi, name_en = excluded.name_en, points_cost = excluded.points_cost,
    discount_type = excluded.discount_type, discount_value = excluded.discount_value,
    minimum_subtotal_vnd = excluded.minimum_subtotal_vnd, maximum_discount_vnd = excluded.maximum_discount_vnd,
    is_active = excluded.is_active;
  v_operation := case when v_before is null then 'created' else 'updated' end;
  select to_jsonb(loyalty_rewards) into v_after from public.loyalty_rewards where id = v_id;
  insert into public.loyalty_reward_change_history (reward_id, operation, before_data, after_data, actor_user_id)
  values (v_id, v_operation, v_before, v_after, (select auth.uid()));
  return query select v_id, v_operation;
end;
$$;

create function public.redeem_loyalty_reward(p_reward_id text, p_idempotency_key uuid)
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
  v_code text := 'REWARD-' || upper(substr(replace(p_idempotency_key::text, '-', ''), 1, 24));
begin
  if v_user_id is null or p_reward_id is null or p_reward_id !~ '^[a-z0-9][a-z0-9-]{2,79}$' or p_idempotency_key is null then raise exception 'INVALID_REDEMPTION'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  select * into v_existing from public.loyalty_ledger where source_key = 'redemption:' || p_idempotency_key::text;
  if found then return query select v_existing.voucher_code, abs(v_existing.points); return; end if;
  select * into v_reward from public.loyalty_rewards where id = p_reward_id and is_active for update;
  if not found then raise exception 'REWARD_NOT_FOUND'; end if;
  if not exists (select 1 from public.loyalty_policy where id and enabled) then raise exception 'LOYALTY_DISABLED'; end if;
  select coalesce(sum(points), 0)::bigint into v_balance from public.loyalty_ledger where user_id = v_user_id;
  if v_balance < v_reward.points_cost then raise exception 'INSUFFICIENT_POINTS'; end if;

  insert into public.vouchers (code, discount_type, discount_value, minimum_subtotal_vnd, maximum_discount_vnd, usage_limit, is_active, assigned_user_id)
  values (v_code, v_reward.discount_type, v_reward.discount_value, v_reward.minimum_subtotal_vnd, v_reward.maximum_discount_vnd, 1, true, v_user_id);
  insert into public.loyalty_ledger (user_id, points, amount_vnd, source_type, source_key, actor_user_id, voucher_code, note)
  values (v_user_id, -v_reward.points_cost, 0, 'redemption', 'redemption:' || p_idempotency_key::text, v_user_id, v_code, 'Reward redemption');
  return query select v_code, v_reward.points_cost;
end;
$$;

create function public.validate_order_voucher_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.voucher_code is not null and exists (
    select 1 from public.vouchers
    where code = new.voucher_code and assigned_user_id is not null and assigned_user_id is distinct from new.user_id
  ) then raise exception 'VOUCHER_OWNER_MISMATCH'; end if;
  return new;
end;
$$;

create trigger orders_validate_voucher_owner
before insert on public.orders
for each row execute function public.validate_order_voucher_owner();

revoke all on function public.admin_upsert_loyalty_reward(text, text, text, integer, public.discount_type, integer, integer, integer, boolean) from public;
grant execute on function public.admin_upsert_loyalty_reward(text, text, text, integer, public.discount_type, integer, integer, integer, boolean) to authenticated;
revoke all on function public.redeem_loyalty_reward(text, uuid) from public;
grant execute on function public.redeem_loyalty_reward(text, uuid) to authenticated;
revoke all on function public.validate_order_voucher_owner() from public;
