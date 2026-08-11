create or replace function public.create_topup_intent(p_package_id uuid, p_idempotency_key uuid)
returns table (purchase_id uuid, amount_vnd integer, points integer, purchase_status text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_package public.topup_packages%rowtype;
  v_existing public.wallet_topups%rowtype;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_package_id is null or p_idempotency_key is null then raise exception 'INVALID_TOPUP'; end if;
  if not exists (select 1 from public.stored_value_policy where id and enabled and topup_enabled) then raise exception 'TOPUP_DISABLED'; end if;

  select * into v_existing from public.wallet_topups where idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.user_id <> v_user_id then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return query select v_existing.id, v_existing.amount_vnd, v_existing.points, v_existing.status, v_existing.expires_at;
    return;
  end if;

  select * into v_package from public.topup_packages
  where id = p_package_id and is_active for update;
  if not found then raise exception 'TOPUP_PACKAGE_NOT_FOUND'; end if;

  update public.wallet_topups as topup
  set status = 'expired', updated_at = now()
  where topup.user_id = v_user_id
    and topup.package_id = v_package.id
    and topup.status = 'pending'
    and topup.expires_at <= now();

  insert into public.wallet_topups (user_id, package_id, idempotency_key, amount_vnd, points, expires_at)
  values (v_user_id, v_package.id, p_idempotency_key, v_package.amount_vnd, v_package.points, now() + interval '30 minutes')
  returning * into v_existing;
  return query select v_existing.id, v_existing.amount_vnd, v_existing.points, v_existing.status, v_existing.expires_at;
end;
$$;

revoke all on function public.create_topup_intent(uuid, uuid) from public;
grant execute on function public.create_topup_intent(uuid, uuid) to authenticated;

create or replace function public.create_flash_sale_intent(p_campaign_id uuid, p_idempotency_key uuid)
returns table (purchase_id uuid, amount_vnd integer, points integer, purchase_status text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_campaign public.flash_sale_campaigns%rowtype;
  v_existing public.flash_sale_purchases%rowtype;
  v_expired integer;
  v_user_count integer;
  v_expires_at timestamptz;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_campaign_id is null or p_idempotency_key is null then raise exception 'INVALID_FLASH_SALE'; end if;
  if not exists (select 1 from public.stored_value_policy where id and enabled and flash_sale_enabled) then raise exception 'FLASH_SALE_DISABLED'; end if;

  select * into v_existing from public.flash_sale_purchases where idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.user_id <> v_user_id then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return query select v_existing.id, v_existing.amount_vnd, v_existing.points, v_existing.status, v_existing.expires_at;
    return;
  end if;

  select * into v_campaign from public.flash_sale_campaigns where id = p_campaign_id for update;
  if not found or not v_campaign.is_active or v_campaign.starts_at > now() or v_campaign.ends_at <= now() then
    raise exception 'FLASH_SALE_UNAVAILABLE';
  end if;

  update public.flash_sale_purchases as purchase
  set status = 'expired', reservation_released = true, updated_at = now()
  where purchase.campaign_id = v_campaign.id
    and purchase.status = 'pending'
    and not purchase.reservation_released
    and purchase.expires_at <= now();
  get diagnostics v_expired = row_count;
  if v_expired > 0 then
    update public.flash_sale_campaigns set quota_reserved = greatest(quota_reserved - v_expired, 0) where id = v_campaign.id;
    select * into v_campaign from public.flash_sale_campaigns where id = v_campaign.id for update;
  end if;

  if v_campaign.quota_total is not null and v_campaign.quota_reserved + v_campaign.quota_sold >= v_campaign.quota_total then
    raise exception 'FLASH_SALE_SOLD_OUT';
  end if;
  if v_campaign.max_per_user is not null then
    select count(*)::integer into v_user_count from public.flash_sale_purchases
    where campaign_id = v_campaign.id and user_id = v_user_id and status in ('pending', 'paid');
    if v_user_count >= v_campaign.max_per_user then raise exception 'FLASH_SALE_USER_LIMIT'; end if;
  end if;

  v_expires_at := least(now() + interval '30 minutes', v_campaign.ends_at);
  insert into public.flash_sale_purchases (user_id, campaign_id, idempotency_key, amount_vnd, points, expires_at)
  values (v_user_id, v_campaign.id, p_idempotency_key, v_campaign.price_vnd, v_campaign.points, v_expires_at)
  returning * into v_existing;
  update public.flash_sale_campaigns set quota_reserved = quota_reserved + 1 where id = v_campaign.id;
  return query select v_existing.id, v_existing.amount_vnd, v_existing.points, v_existing.status, v_existing.expires_at;
end;
$$;

revoke all on function public.create_flash_sale_intent(uuid, uuid) from public;
grant execute on function public.create_flash_sale_intent(uuid, uuid) to authenticated;
