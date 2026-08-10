create table public.stored_value_policy (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  topup_enabled boolean not null default false,
  flash_sale_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete restrict
);

insert into public.stored_value_policy (id, enabled, topup_enabled, flash_sale_enabled)
values (true, false, false, false)
on conflict (id) do nothing;

create table public.topup_packages (
  id uuid primary key default gen_random_uuid(),
  name_vi text not null check (char_length(name_vi) between 3 and 180),
  name_en text not null check (char_length(name_en) between 3 and 180),
  amount_vnd integer not null check (amount_vnd > 0),
  points integer not null check (points > 0),
  is_active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.flash_sale_campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  name_vi text not null check (char_length(name_vi) between 3 and 180),
  name_en text not null check (char_length(name_en) between 3 and 180),
  price_vnd integer not null check (price_vnd > 0),
  points integer not null check (points > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  quota_total integer check (quota_total is null or quota_total > 0),
  quota_reserved integer not null default 0 check (quota_reserved >= 0),
  quota_sold integer not null default 0 check (quota_sold >= 0),
  max_per_user integer check (max_per_user is null or max_per_user > 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (quota_total is null or quota_reserved + quota_sold <= quota_total)
);

create table public.wallet_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  package_id uuid not null references public.topup_packages (id) on delete restrict,
  idempotency_key uuid not null unique,
  amount_vnd integer not null check (amount_vnd > 0),
  points integer not null check (points > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'expired')),
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'paid') = (paid_at is not null))
);

create table public.flash_sale_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  campaign_id uuid not null references public.flash_sale_campaigns (id) on delete restrict,
  idempotency_key uuid not null unique,
  amount_vnd integer not null check (amount_vnd > 0),
  points integer not null check (points > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'expired')),
  reservation_released boolean not null default false,
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'paid') = (paid_at is not null))
);

create table public.stored_value_payments (
  id uuid primary key default gen_random_uuid(),
  topup_id uuid references public.wallet_topups (id) on delete restrict,
  flash_sale_purchase_id uuid references public.flash_sale_purchases (id) on delete restrict,
  provider text not null default 'sepay' check (provider = 'sepay'),
  payment_code text not null unique check (payment_code ~ '^B[TF][0-9]+$'),
  amount_vnd integer not null check (amount_vnd > 0),
  bank_code text not null check (char_length(bank_code) between 2 and 32),
  account_number text not null check (char_length(account_number) between 4 and 64),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'expired', 'refunded')),
  provider_transaction_id bigint unique,
  provider_reference text,
  provider_payload jsonb,
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((topup_id is not null) <> (flash_sale_purchase_id is not null)),
  check ((status in ('paid', 'refunded')) = (paid_at is not null))
);

create table public.stored_value_webhook_events (
  provider_transaction_id bigint primary key,
  payment_id uuid references public.stored_value_payments (id) on delete set null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'rejected')),
  reason text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

insert into public.topup_packages (id, name_vi, name_en, amount_vnd, points, is_active, sort_order)
values
  ('00000000-0000-4000-8000-000000000101', 'Nạp 100.000đ', 'Top up 100,000 VND', 100000, 100000, true, 10),
  ('00000000-0000-4000-8000-000000000102', 'Nạp 250.000đ', 'Top up 250,000 VND', 250000, 260000, true, 20),
  ('00000000-0000-4000-8000-000000000103', 'Nạp 500.000đ', 'Top up 500,000 VND', 500000, 540000, true, 30)
on conflict (id) do nothing;

alter table public.loyalty_ledger drop constraint if exists loyalty_ledger_source_type_check;
alter table public.loyalty_ledger add constraint loyalty_ledger_source_type_check
  check (source_type in ('order_earned', 'order_reversal', 'redemption', 'manual_adjustment', 'topup_credited', 'flash_sale_credited'));

create unique index wallet_topups_user_active_package_idx
on public.wallet_topups (user_id, package_id)
where status = 'pending';
create unique index flash_sale_purchases_topup_idx
on public.stored_value_payments (topup_id)
where topup_id is not null;
create unique index stored_value_payments_flash_sale_idx
on public.stored_value_payments (flash_sale_purchase_id)
where flash_sale_purchase_id is not null;
create index wallet_topups_user_created_idx on public.wallet_topups (user_id, created_at desc);
create index flash_sale_purchases_user_created_idx on public.flash_sale_purchases (user_id, created_at desc);
create index stored_value_payments_status_expires_idx on public.stored_value_payments (status, expires_at);

alter table public.stored_value_policy enable row level security;
alter table public.topup_packages enable row level security;
alter table public.flash_sale_campaigns enable row level security;
alter table public.wallet_topups enable row level security;
alter table public.flash_sale_purchases enable row level security;
alter table public.stored_value_payments enable row level security;
alter table public.stored_value_webhook_events enable row level security;

revoke all on table public.stored_value_policy, public.topup_packages, public.flash_sale_campaigns,
  public.wallet_topups, public.flash_sale_purchases, public.stored_value_payments,
  public.stored_value_webhook_events from anon, authenticated;
grant all on table public.stored_value_policy, public.topup_packages, public.flash_sale_campaigns,
  public.wallet_topups, public.flash_sale_purchases, public.stored_value_payments,
  public.stored_value_webhook_events to service_role;

create trigger topup_packages_set_updated_at before update on public.topup_packages
for each row execute function public.set_updated_at();
create trigger flash_sale_campaigns_set_updated_at before update on public.flash_sale_campaigns
for each row execute function public.set_updated_at();
create trigger wallet_topups_set_updated_at before update on public.wallet_topups
for each row execute function public.set_updated_at();
create trigger flash_sale_purchases_set_updated_at before update on public.flash_sale_purchases
for each row execute function public.set_updated_at();
create trigger stored_value_payments_set_updated_at before update on public.stored_value_payments
for each row execute function public.set_updated_at();

create table public.stored_value_policy_history (
  id bigint generated always as identity primary key,
  enabled boolean not null,
  topup_enabled boolean not null,
  flash_sale_enabled boolean not null,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.stored_value_policy_history enable row level security;
revoke all on table public.stored_value_policy_history from anon, authenticated;
grant select on table public.stored_value_policy_history to authenticated;
grant all on table public.stored_value_policy_history to service_role;
create policy "Admins read stored value policy history"
on public.stored_value_policy_history for select to authenticated
using ((select public.current_user_role()) = 'admin');

create function public.get_stored_value_catalog()
returns table (
  kind text,
  item_id uuid,
  name_vi text,
  name_en text,
  amount_vnd integer,
  points integer,
  starts_at timestamptz,
  ends_at timestamptz,
  remaining_quantity integer,
  max_per_user integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.stored_value_policy where id and enabled) then return; end if;

  if exists (select 1 from public.stored_value_policy where id and topup_enabled) then
    return query
    select 'topup'::text, packages.id, packages.name_vi, packages.name_en,
      packages.amount_vnd, packages.points, null::timestamptz, null::timestamptz,
      null::integer, null::integer
    from public.topup_packages packages
    where packages.is_active
    order by packages.sort_order, packages.amount_vnd;
  end if;

  if exists (select 1 from public.stored_value_policy where id and flash_sale_enabled) then
    return query
    select 'flash_sale'::text, campaigns.id, campaigns.name_vi, campaigns.name_en,
      campaigns.price_vnd, campaigns.points, campaigns.starts_at, campaigns.ends_at,
      case when campaigns.quota_total is null then null::integer
        else greatest(campaigns.quota_total - campaigns.quota_reserved - campaigns.quota_sold, 0) end,
      campaigns.max_per_user
    from public.flash_sale_campaigns campaigns
    where campaigns.is_active and campaigns.starts_at <= now() and campaigns.ends_at > now()
    order by campaigns.ends_at, campaigns.price_vnd;
  end if;
end;
$$;

create function public.create_topup_intent(p_package_id uuid, p_idempotency_key uuid)
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

  update public.wallet_topups
  set status = 'expired', updated_at = now()
  where user_id = v_user_id and package_id = v_package.id and status = 'pending' and expires_at <= now();

  insert into public.wallet_topups (user_id, package_id, idempotency_key, amount_vnd, points, expires_at)
  values (v_user_id, v_package.id, p_idempotency_key, v_package.amount_vnd, v_package.points, now() + interval '30 minutes')
  returning * into v_existing;
  return query select v_existing.id, v_existing.amount_vnd, v_existing.points, v_existing.status, v_existing.expires_at;
end;
$$;

create function public.create_flash_sale_intent(p_campaign_id uuid, p_idempotency_key uuid)
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

  update public.flash_sale_purchases
  set status = 'expired', reservation_released = true, updated_at = now()
  where campaign_id = v_campaign.id and status = 'pending' and not reservation_released and expires_at <= now();
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

create function public.create_stored_value_payment(
  p_purchase_type text,
  p_purchase_id uuid,
  p_bank_code text,
  p_account_number text
)
returns table (payment_id uuid, payment_code text, amount_vnd integer, payment_status text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_topup public.wallet_topups%rowtype;
  v_flash public.flash_sale_purchases%rowtype;
  v_existing public.stored_value_payments%rowtype;
  v_prefix text;
  v_amount integer;
  v_expires_at timestamptz;
  v_payment_code text;
begin
  if p_purchase_type not in ('topup', 'flash_sale') or p_purchase_id is null
    or char_length(trim(p_bank_code)) not between 2 and 32
    or char_length(trim(p_account_number)) not between 4 and 64 then raise exception 'INVALID_PAYMENT_DESTINATION'; end if;

  if p_purchase_type = 'topup' then
    select * into v_topup from public.wallet_topups where id = p_purchase_id for update;
    if not found then raise exception 'TOPUP_NOT_PAYABLE'; end if;
    select * into v_existing from public.stored_value_payments where topup_id = v_topup.id;
    if v_existing.id is not null then
      return query select v_existing.id, v_existing.payment_code, v_existing.amount_vnd, v_existing.status, v_existing.expires_at;
      return;
    end if;
    if v_topup.status <> 'pending' or v_topup.expires_at <= now() then raise exception 'TOPUP_NOT_PAYABLE'; end if;
    v_prefix := 'BT';
    v_amount := v_topup.amount_vnd;
    v_expires_at := v_topup.expires_at;
  else
    select * into v_flash from public.flash_sale_purchases where id = p_purchase_id for update;
    if not found then raise exception 'FLASH_SALE_NOT_PAYABLE'; end if;
    select * into v_existing from public.stored_value_payments where flash_sale_purchase_id = v_flash.id;
    if v_existing.id is not null then
      return query select v_existing.id, v_existing.payment_code, v_existing.amount_vnd, v_existing.status, v_existing.expires_at;
      return;
    end if;
    if v_flash.status <> 'pending' or v_flash.expires_at <= now() then raise exception 'FLASH_SALE_NOT_PAYABLE'; end if;
    v_prefix := 'BF';
    v_amount := v_flash.amount_vnd;
    v_expires_at := v_flash.expires_at;
  end if;

  v_payment_code := v_prefix || nextval('public.stored_value_payment_code_seq')::text;
  insert into public.stored_value_payments (
    topup_id, flash_sale_purchase_id, payment_code, amount_vnd, bank_code, account_number, expires_at
  ) values (
    case when p_purchase_type = 'topup' then p_purchase_id else null end,
    case when p_purchase_type = 'flash_sale' then p_purchase_id else null end,
    v_payment_code, v_amount, trim(p_bank_code), trim(p_account_number), v_expires_at
  ) returning * into v_existing;
  return query select v_existing.id, v_existing.payment_code, v_existing.amount_vnd, v_existing.status, v_existing.expires_at;
end;
$$;

create sequence public.stored_value_payment_code_seq;

create function public.get_stored_value_purchase(p_purchase_id uuid)
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
  select 'topup'::text, topups.id, topups.amount_vnd, topups.points, topups.status,
    payments.status, payments.payment_code, topups.expires_at, topups.paid_at
  from public.wallet_topups topups
  left join public.stored_value_payments payments on payments.topup_id = topups.id
  where topups.id = p_purchase_id and topups.user_id = (select auth.uid());
  if found then return; end if;
  return query
  select 'flash_sale'::text, purchases.id, purchases.amount_vnd, purchases.points, purchases.status,
    payments.status, payments.payment_code, purchases.expires_at, purchases.paid_at
  from public.flash_sale_purchases purchases
  left join public.stored_value_payments payments on payments.flash_sale_purchase_id = purchases.id
  where purchases.id = p_purchase_id and purchases.user_id = (select auth.uid());
end;
$$;

create function public.process_stored_value_webhook(
  p_provider_transaction_id bigint,
  p_gateway text,
  p_transaction_at timestamptz,
  p_account_number text,
  p_code text,
  p_transfer_type text,
  p_transfer_amount integer,
  p_reference_code text,
  p_payload jsonb
)
returns table (outcome text, matched_purchase_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.stored_value_payments%rowtype;
  v_topup public.wallet_topups%rowtype;
  v_flash public.flash_sale_purchases%rowtype;
  v_inserted integer;
begin
  insert into public.stored_value_webhook_events (provider_transaction_id, payload)
  values (p_provider_transaction_id, p_payload)
  on conflict (provider_transaction_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    select stored_value_payments.* into v_payment
    from public.stored_value_webhook_events events
    left join public.stored_value_payments on stored_value_payments.id = events.payment_id
    where events.provider_transaction_id = p_provider_transaction_id;
    return query select 'duplicate'::text, coalesce(v_payment.topup_id, v_payment.flash_sale_purchase_id);
    return;
  end if;

  if p_transfer_type <> 'in' then
    update public.stored_value_webhook_events set status = 'rejected', reason = 'NOT_INBOUND', processed_at = now()
    where provider_transaction_id = p_provider_transaction_id;
    return query select 'rejected'::text, null::uuid;
    return;
  end if;

  select * into v_payment from public.stored_value_payments where payment_code = upper(trim(p_code)) for update;
  if not found then
    update public.stored_value_webhook_events set status = 'rejected', reason = 'PAYMENT_NOT_FOUND', processed_at = now()
    where provider_transaction_id = p_provider_transaction_id;
    return query select 'rejected'::text, null::uuid;
    return;
  end if;
  update public.stored_value_webhook_events set payment_id = v_payment.id where provider_transaction_id = p_provider_transaction_id;

  if p_account_number <> v_payment.account_number or p_transfer_amount <> v_payment.amount_vnd then
    update public.stored_value_webhook_events set status = 'rejected', reason = case when p_account_number <> v_payment.account_number then 'ACCOUNT_MISMATCH' else 'AMOUNT_MISMATCH' end, processed_at = now()
    where provider_transaction_id = p_provider_transaction_id;
    return query select 'rejected'::text, coalesce(v_payment.topup_id, v_payment.flash_sale_purchase_id);
    return;
  end if;
  if p_transaction_at < v_payment.created_at - interval '5 minutes' or p_transaction_at > v_payment.expires_at then
    update public.stored_value_payments set status = 'expired' where id = v_payment.id and status = 'pending';
    update public.stored_value_webhook_events set status = 'rejected', reason = 'PAYMENT_EXPIRED', processed_at = now()
    where provider_transaction_id = p_provider_transaction_id;
    return query select 'rejected'::text, coalesce(v_payment.topup_id, v_payment.flash_sale_purchase_id);
    return;
  end if;
  if v_payment.status <> 'pending' then
    update public.stored_value_webhook_events set status = 'rejected', reason = 'PAYMENT_NOT_PENDING', processed_at = now()
    where provider_transaction_id = p_provider_transaction_id;
    return query select 'rejected'::text, coalesce(v_payment.topup_id, v_payment.flash_sale_purchase_id);
    return;
  end if;

  update public.stored_value_payments set status = 'paid', provider_transaction_id = p_provider_transaction_id,
    provider_reference = nullif(trim(p_reference_code), ''), provider_payload = p_payload, paid_at = p_transaction_at
  where id = v_payment.id;

  if v_payment.topup_id is not null then
    select * into v_topup from public.wallet_topups where id = v_payment.topup_id for update;
    if not found or v_topup.status <> 'pending' then raise exception 'TOPUP_NOT_PENDING'; end if;
    update public.wallet_topups set status = 'paid', paid_at = p_transaction_at where id = v_topup.id;
    insert into public.loyalty_ledger (user_id, points, amount_vnd, source_type, source_key, note)
    values (v_topup.user_id, v_topup.points, v_topup.amount_vnd, 'topup_credited', 'topup:' || v_topup.id::text || ':credited', 'Verified stored-value top-up')
    on conflict (source_key) do nothing;
  else
    select * into v_flash from public.flash_sale_purchases where id = v_payment.flash_sale_purchase_id for update;
    if not found or v_flash.status <> 'pending' then raise exception 'FLASH_SALE_NOT_PENDING'; end if;
    update public.flash_sale_purchases set status = 'paid', paid_at = p_transaction_at where id = v_flash.id;
    update public.flash_sale_campaigns set quota_reserved = greatest(quota_reserved - 1, 0), quota_sold = quota_sold + 1 where id = v_flash.campaign_id;
    insert into public.loyalty_ledger (user_id, points, amount_vnd, source_type, source_key, note)
    values (v_flash.user_id, v_flash.points, v_flash.amount_vnd, 'flash_sale_credited', 'flash-sale:' || v_flash.id::text || ':credited', 'Verified flash-sale purchase')
    on conflict (source_key) do nothing;
  end if;

  update public.stored_value_webhook_events set status = 'processed', processed_at = now()
  where provider_transaction_id = p_provider_transaction_id;
  return query select 'processed'::text, coalesce(v_payment.topup_id, v_payment.flash_sale_purchase_id);
end;
$$;

create function public.get_stored_value_policy()
returns table (enabled boolean, topup_enabled boolean, flash_sale_enabled boolean, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select policy.enabled, policy.topup_enabled, policy.flash_sale_enabled, policy.updated_at
  from public.stored_value_policy policy
  where policy.id and (select public.current_user_role()) = 'admin'
$$;

create function public.get_admin_stored_value_catalog()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'policy', (select to_jsonb(policy) from public.stored_value_policy policy where policy.id),
    'topups', coalesce((select jsonb_agg(to_jsonb(packages) order by packages.sort_order, packages.amount_vnd) from public.topup_packages packages), '[]'::jsonb),
    'campaigns', coalesce((select jsonb_agg(to_jsonb(campaigns) order by campaigns.ends_at, campaigns.price_vnd) from public.flash_sale_campaigns campaigns), '[]'::jsonb),
    'policyHistory', coalesce((select jsonb_agg(to_jsonb(history) order by history.created_at desc) from (select * from public.stored_value_policy_history order by created_at desc limit 20) history), '[]'::jsonb)
  )
  where (select public.current_user_role()) = 'admin'
$$;

create function public.update_stored_value_policy(
  p_enabled boolean,
  p_topup_enabled boolean,
  p_flash_sale_enabled boolean
)
returns table (updated_enabled boolean, updated_topup_enabled boolean, updated_flash_sale_enabled boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select public.current_user_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_enabled is null or p_topup_enabled is null or p_flash_sale_enabled is null then raise exception 'INVALID_STORED_VALUE_POLICY'; end if;
  update public.stored_value_policy
  set enabled = p_enabled, topup_enabled = p_topup_enabled, flash_sale_enabled = p_flash_sale_enabled,
    updated_at = now(), updated_by = (select auth.uid())
  where id;
  insert into public.stored_value_policy_history (enabled, topup_enabled, flash_sale_enabled, actor_user_id)
  values (p_enabled, p_topup_enabled, p_flash_sale_enabled, (select auth.uid()));
  return query select p_enabled, p_topup_enabled, p_flash_sale_enabled;
end;
$$;

create function public.admin_upsert_topup_package(
  p_package_id uuid,
  p_name_vi text,
  p_name_en text,
  p_amount_vnd integer,
  p_points integer,
  p_is_active boolean,
  p_sort_order integer
)
returns table (updated_package_id uuid, operation text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_package_id, gen_random_uuid());
  v_exists boolean;
begin
  if (select public.current_user_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_name_vi is null or char_length(trim(p_name_vi)) not between 3 and 180
    or p_name_en is null or char_length(trim(p_name_en)) not between 3 and 180
    or p_amount_vnd is null or p_amount_vnd <= 0
    or p_points is null or p_points <= 0
    or p_is_active is null or p_sort_order is null then raise exception 'INVALID_TOPUP_PACKAGE'; end if;
  select exists(select 1 from public.topup_packages where id = v_id) into v_exists;
  insert into public.topup_packages (id, name_vi, name_en, amount_vnd, points, is_active, sort_order)
  values (v_id, trim(p_name_vi), trim(p_name_en), p_amount_vnd, p_points, p_is_active, p_sort_order)
  on conflict (id) do update set name_vi = excluded.name_vi, name_en = excluded.name_en,
    amount_vnd = excluded.amount_vnd, points = excluded.points, is_active = excluded.is_active, sort_order = excluded.sort_order;
  return query select v_id, case when v_exists then 'updated'::text else 'created'::text end;
end;
$$;

create function public.admin_upsert_flash_sale_campaign(
  p_campaign_id uuid,
  p_slug text,
  p_name_vi text,
  p_name_en text,
  p_price_vnd integer,
  p_points integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_quota_total integer,
  p_max_per_user integer,
  p_is_active boolean
)
returns table (updated_campaign_id uuid, operation text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_campaign_id, gen_random_uuid());
  v_exists boolean;
  v_reserved integer := 0;
  v_sold integer := 0;
begin
  if (select public.current_user_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_slug is null or trim(p_slug) !~ '^[a-z0-9][a-z0-9-]{2,79}$'
    or p_name_vi is null or char_length(trim(p_name_vi)) not between 3 and 180
    or p_name_en is null or char_length(trim(p_name_en)) not between 3 and 180
    or p_price_vnd is null or p_price_vnd <= 0
    or p_points is null or p_points <= 0
    or p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at
    or (p_quota_total is not null and p_quota_total <= 0)
    or (p_max_per_user is not null and p_max_per_user <= 0)
    or p_is_active is null then raise exception 'INVALID_FLASH_SALE'; end if;
  select exists(select 1 from public.flash_sale_campaigns where id = v_id) into v_exists;
  if v_exists then
    select quota_reserved, quota_sold into v_reserved, v_sold from public.flash_sale_campaigns where id = v_id for update;
    if p_quota_total is not null and p_quota_total < v_reserved + v_sold then raise exception 'FLASH_SALE_QUOTA_TOO_LOW'; end if;
  end if;
  insert into public.flash_sale_campaigns (id, slug, name_vi, name_en, price_vnd, points, starts_at, ends_at, quota_total, max_per_user, is_active)
  values (v_id, lower(trim(p_slug)), trim(p_name_vi), trim(p_name_en), p_price_vnd, p_points, p_starts_at, p_ends_at, p_quota_total, p_max_per_user, p_is_active)
  on conflict (id) do update set slug = excluded.slug, name_vi = excluded.name_vi, name_en = excluded.name_en,
    price_vnd = excluded.price_vnd, points = excluded.points, starts_at = excluded.starts_at, ends_at = excluded.ends_at,
    quota_total = excluded.quota_total, max_per_user = excluded.max_per_user, is_active = excluded.is_active;
  return query select v_id, case when v_exists then 'updated'::text else 'created'::text end;
end;
$$;

revoke all on function public.get_stored_value_catalog() from public;
grant execute on function public.get_stored_value_catalog() to authenticated;
revoke all on function public.create_topup_intent(uuid, uuid) from public;
grant execute on function public.create_topup_intent(uuid, uuid) to authenticated;
revoke all on function public.create_flash_sale_intent(uuid, uuid) from public;
grant execute on function public.create_flash_sale_intent(uuid, uuid) to authenticated;
revoke all on function public.create_stored_value_payment(text, uuid, text, text) from public;
grant execute on function public.create_stored_value_payment(text, uuid, text, text) to service_role;
revoke all on function public.get_stored_value_purchase(uuid) from public;
grant execute on function public.get_stored_value_purchase(uuid) to authenticated;
revoke all on function public.process_stored_value_webhook(bigint, text, timestamptz, text, text, text, integer, text, jsonb) from public;
grant execute on function public.process_stored_value_webhook(bigint, text, timestamptz, text, text, text, integer, text, jsonb) to service_role;
revoke all on function public.get_stored_value_policy() from public;
grant execute on function public.get_stored_value_policy() to authenticated;
revoke all on function public.get_admin_stored_value_catalog() from public;
grant execute on function public.get_admin_stored_value_catalog() to authenticated;
revoke all on function public.update_stored_value_policy(boolean, boolean, boolean) from public;
grant execute on function public.update_stored_value_policy(boolean, boolean, boolean) to authenticated;
revoke all on function public.admin_upsert_topup_package(uuid, text, text, integer, integer, boolean, integer) from public;
grant execute on function public.admin_upsert_topup_package(uuid, text, text, integer, integer, boolean, integer) to authenticated;
revoke all on function public.admin_upsert_flash_sale_campaign(uuid, text, text, text, integer, integer, timestamptz, timestamptz, integer, integer, boolean) from public;
grant execute on function public.admin_upsert_flash_sale_campaign(uuid, text, text, text, integer, integer, timestamptz, timestamptz, integer, integer, boolean) to authenticated;
