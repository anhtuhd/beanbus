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
begin
  if new.user_id is null then return new; end if;
  select * into v_policy from public.loyalty_policy where id;

  if found and v_policy.enabled and v_policy.earn_bps > 0
    and new.status = 'completed'
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
  v_code text := 'REWARD-' || upper(substr(replace(p_idempotency_key::text, '-', ''), 1, 24));
begin
  if v_user_id is null or p_reward_id is null or p_reward_id !~ '^[a-z0-9][a-z0-9-]{2,79}$' or p_idempotency_key is null then raise exception 'INVALID_REDEMPTION'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select * into v_existing
  from public.loyalty_ledger
  where source_key = 'redemption:' || p_idempotency_key::text
    and user_id = v_user_id;
  if found then return query select v_existing.voucher_code, abs(v_existing.points); return; end if;

  if exists (
    select 1 from public.loyalty_ledger
    where source_key = 'redemption:' || p_idempotency_key::text
      and user_id is distinct from v_user_id
  ) then
    raise exception 'IDEMPOTENCY_CONFLICT';
  end if;

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
