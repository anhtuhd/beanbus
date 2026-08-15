-- Counter membership, restricted operator POS, member passes and voucher wallet.
-- All write paths below are security-definer RPCs with explicit role checks.

do $$
begin
  create type public.membership_status as enum ('pending', 'active', 'blocked');
exception when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists pending_phone text,
  add column if not exists membership_status public.membership_status not null default 'active';

alter table public.profiles
  drop constraint if exists profiles_phone_format_check,
  drop constraint if exists profiles_pending_phone_format_check;

alter table public.profiles
  add constraint profiles_phone_format_check check (phone is null or phone ~ '^\+84[35789][0-9]{8}$'),
  add constraint profiles_pending_phone_format_check check (pending_phone is null or pending_phone ~ '^\+84[35789][0-9]{8}$');

do $$
declare
  v_duplicate_count integer;
begin
  select count(*) into v_duplicate_count
  from (
    select coalesce(phone, pending_phone) as normalized_phone
    from public.profiles
    where coalesce(phone, pending_phone) is not null
    group by coalesce(phone, pending_phone)
    having count(*) > 1
  ) duplicates;
  if v_duplicate_count > 0 then
    raise exception 'DUPLICATE_MEMBER_PHONE';
  end if;
end $$;

create unique index if not exists profiles_phone_identity_uidx
on public.profiles (coalesce(phone, pending_phone))
where coalesce(phone, pending_phone) is not null;

comment on column public.profiles.pending_phone is 'Phone supplied at the counter; activation moves it to phone after OTP verification.';
comment on column public.profiles.membership_status is 'pending members can use counter benefits but cannot sign in until phone activation.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id, full_name, phone, pending_phone, membership_status, email, avatar_url
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    case when new.phone_confirmed_at is null then null else new.phone end,
    case when new.phone_confirmed_at is null then nullif(new.raw_user_meta_data ->> 'pending_phone', new.phone) else null end,
    case when new.phone_confirmed_at is null and new.phone is not null then 'pending'::public.membership_status else 'active'::public.membership_status end,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function private.sync_verified_phone_to_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set phone = case when new.phone_confirmed_at is null then phone else new.phone end,
      pending_phone = case when new.phone_confirmed_at is null then coalesce(pending_phone, new.phone) else null end,
      membership_status = case when new.phone_confirmed_at is null then membership_status else 'active'::public.membership_status end
  where id = new.id;
  return new;
end;
$$;

drop function if exists public.get_current_profile();
create function public.get_current_profile()
returns table (id uuid, member_number bigint, full_name text, phone text, pending_phone text, email text, birthday date, avatar_url text, role public.app_role, membership_status public.membership_status, created_at timestamptz, updated_at timestamptz)
language sql stable security invoker set search_path = ''
as $$
  select p.id, p.member_number, p.full_name, p.phone, p.pending_phone, p.email, p.birthday, p.avatar_url, p.role, p.membership_status, p.created_at, p.updated_at
  from public.profiles p where p.id = (select auth.uid());
$$;
revoke all on function public.get_current_profile() from public, anon;
grant execute on function public.get_current_profile() to authenticated;

create or replace function public.get_member_loyalty_summary_v2(p_user_id uuid)
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
  if p_user_id is null
    or ((select auth.uid()) is distinct from p_user_id and (select public.current_user_role()) is distinct from 'admin') then
    raise exception 'LOYALTY_FORBIDDEN';
  end if;
  if exists (select 1 from public.profiles where id = p_user_id and membership_status = 'blocked') then
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

create or replace function public.operator_register_pending_member(
  p_user_id uuid,
  p_pending_phone text,
  p_full_name text
)
returns table (member_id uuid, member_number bigint, membership_status public.membership_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if (select public.current_user_role()) not in ('admin', 'staff') then raise exception 'OPERATOR_REQUIRED'; end if;
  if p_user_id is null or p_pending_phone is null or p_pending_phone !~ '^\+84[35789][0-9]{8}$' then
    raise exception 'INVALID_MEMBER_PHONE';
  end if;
  if char_length(trim(coalesce(p_full_name, ''))) not between 2 and 100 then raise exception 'INVALID_MEMBER_NAME'; end if;
  if not exists (
    select 1
    from auth.users u
    join public.profiles p on p.id = u.id
    where u.id = p_user_id
      and u.phone = p_pending_phone
      and u.phone_confirmed_at is null
      and p.role = 'member'
      and p.phone is null
      and p.pending_phone = p_pending_phone
      and p.membership_status = 'pending'
  ) then
    raise exception 'PENDING_MEMBER_REQUIRED';
  end if;

  update public.profiles
  set full_name = trim(p_full_name), phone = null, pending_phone = p_pending_phone,
      membership_status = 'pending'::public.membership_status
  where id = p_user_id and role = 'member'
  returning * into v_profile;
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;

  return query select v_profile.id, v_profile.member_number, v_profile.membership_status;
exception when unique_violation then
  raise exception 'MEMBER_PHONE_EXISTS';
end;
$$;

create or replace function public.operator_search_members(
  p_query text,
  p_limit integer default 10
)
returns table (
  id uuid,
  member_number bigint,
  full_name text,
  phone text,
  pending_phone text,
  email text,
  membership_status public.membership_status,
  available_points bigint
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_query text := lower(trim(coalesce(p_query, '')));
  v_phone text := regexp_replace(v_query, '[[:space:]().-]', '', 'g');
  v_member_number bigint;
begin
  if (select public.current_user_role()) not in ('admin', 'staff') then raise exception 'OPERATOR_REQUIRED'; end if;
  if char_length(v_query) < 2 then return; end if;
  if v_phone ~ '^\+84[35789][0-9]{8}$' then
    v_phone := v_phone;
  elsif v_phone ~ '^0[35789][0-9]{8}$' then
    v_phone := '+84' || substring(v_phone from 2);
  else
    v_phone := null;
  end if;
  if regexp_replace(v_query, '^bb-', '') ~ '^[0-9]{1,12}$' then
    v_member_number := regexp_replace(v_query, '^bb-', '')::bigint;
  end if;
  if v_phone is null and v_member_number is null then return; end if;

  return query
  select p.id, p.member_number, p.full_name, p.phone, p.pending_phone, null::text,
    p.membership_status,
    greatest(coalesce(sum(l.points), 0), 0)::bigint
  from public.profiles p
  left join public.loyalty_ledger l on l.user_id = p.id
  where p.role = 'member'
    and p.membership_status <> 'blocked'
    and (
      (v_phone is not null and (p.phone = v_phone or p.pending_phone = v_phone))
      or (v_member_number is not null and p.member_number = v_member_number)
    )
  group by p.id
  order by case when v_phone is not null and (p.phone = v_phone or p.pending_phone = v_phone) then 0 else 1 end,
    p.full_name
  limit least(greatest(coalesce(p_limit, 10), 1), 20);
end;
$$;

-- The existing status audit originally accepted only admin/system actors.
alter table public.order_status_history
  drop constraint if exists order_status_history_actor_type_check,
  drop constraint if exists order_status_history_check;
alter table public.order_status_history
  add constraint order_status_history_actor_type_check check (actor_type in ('admin', 'staff', 'system')),
  add constraint order_status_history_actor_check check (
    (actor_type in ('admin', 'staff') and actor_user_id is not null)
    or (actor_type = 'system' and actor_user_id is null)
  );

create or replace function public.audit_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_role public.app_role := (select public.current_user_role());
  v_actor_type text;
begin
  if old.status is distinct from new.status then
    v_actor_type := case when v_actor_id is not null and v_role in ('admin', 'staff') then v_role::text else 'system' end;
    insert into public.order_status_history (order_id, from_status, to_status, actor_user_id, actor_type)
    values (new.id, old.status, new.status, case when v_actor_type in ('admin', 'staff') then v_actor_id end, v_actor_type);
  end if;
  return new;
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
returns table (order_id uuid, order_number bigint, subtotal_vnd integer, discount_vnd integer, total_vnd integer, points_applied integer, cash_due_vnd integer, receipt_token uuid, request_fingerprint text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creation_mode text := coalesce(nullif(current_setting('beanbus.order_creation_mode', true), ''), 'customer_web');
  v_admin_mode boolean := v_creation_mode in ('admin_panel', 'pos');
  v_operator_entry boolean := current_setting('beanbus.operator_entry', true) = 'true';
  v_user_id uuid := case when v_admin_mode then nullif(current_setting('beanbus.order_target_user_id', true), '')::uuid else (select auth.uid()) end;
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
  if v_admin_mode and (select public.current_user_role()) is distinct from 'admin'
    and not ((select public.current_user_role()) = 'staff' and v_operator_entry) then raise exception 'ADMIN_REQUIRED'; end if;
  if v_admin_mode and v_user_id is not null and not exists (select 1 from public.profiles where id = v_user_id and role = 'member' and membership_status <> 'blocked') then raise exception 'TARGET_MEMBER_REQUIRED'; end if;
  if not v_admin_mode and v_user_id is not null and exists (select 1 from public.profiles where id = v_user_id and membership_status = 'blocked') then raise exception 'MEMBER_BLOCKED'; end if;
  if v_admin_mode and v_points > 0 and (not v_consent or char_length(v_consent_note) not between 10 and 300) then raise exception 'POINTS_CONSENT_REQUIRED'; end if;
  if v_points > 0 and v_user_id is null then raise exception 'POINTS_AUTH_REQUIRED'; end if;
  if v_user_id is not null then perform pg_advisory_xact_lock(public.loyalty_wallet_lock_key(v_user_id)); end if;
  perform pg_advisory_xact_lock(pg_catalog.hashtextextended('beanbus:order-idempotency:' || p_idempotency_key::text, 0));

  v_fingerprint := encode(extensions.digest(jsonb_build_object(
    'customerName', trim(p_customer_name), 'customerPhone', p_customer_phone, 'fulfillment', p_fulfillment::text,
    'pickupAt', p_pickup_at, 'deliveryAddress', nullif(trim(p_delivery_address), ''), 'note', nullif(trim(p_note), ''),
    'paymentMethod', p_payment_method::text, 'voucherCode', nullif(upper(trim(p_voucher_code)), ''), 'items', p_items,
    'pointsToApply', v_points, 'targetUserId', v_user_id, 'creationMode', v_creation_mode,
    'actorUserId', case when v_admin_mode then v_actor_id end
  )::text, 'sha256'), 'hex');

  select * into v_order from public.orders where idempotency_key = p_idempotency_key for update;
  if found then
    if v_order.user_id is distinct from v_user_id or v_order.request_fingerprint is distinct from v_fingerprint or coalesce(v_order.points_applied, 0) <> v_points then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return query select v_order.id, v_order.order_number, v_order.subtotal_vnd, v_order.discount_vnd, v_order.total_vnd, v_order.points_applied, v_order.cash_due_vnd, v_order.receipt_token, v_fingerprint;
    return;
  end if;
  if v_points > 0 and not exists (select 1 from public.loyalty_policy where id and points_payment_enabled) then raise exception 'POINTS_PAYMENT_DISABLED'; end if;

  perform pg_catalog.set_config('beanbus.server_priced_order_v2', 'true', true);
  select * into v_legacy from public.create_server_priced_order_legacy(
    p_idempotency_key, p_customer_name, p_customer_phone, p_fulfillment, p_pickup_at, p_delivery_address, p_note, p_payment_method, p_voucher_code, p_items
  );
  select * into v_order from public.orders where id = v_legacy.order_id for update;
  if v_points > v_order.total_vnd then raise exception 'POINTS_EXCEED_ORDER_TOTAL'; end if;
  if v_points > 0 then
    select greatest(coalesce(sum(points), 0), 0)::bigint into v_available from public.loyalty_ledger where user_id = v_user_id;
    if v_available < v_points then raise exception 'INSUFFICIENT_POINTS'; end if;
  end if;
  update public.orders set points_applied = v_points, cash_due_vnd = v_order.total_vnd - v_points, request_fingerprint = v_fingerprint,
    payment_status = case when v_order.total_vnd - v_points = 0 then 'paid' else payment_status end,
    status = case when v_admin_mode and (p_payment_method = 'cod' or v_order.total_vnd - v_points = 0) then 'confirmed' else status end
  where id = v_order.id returning * into v_order;
  if v_points > 0 then
    insert into public.loyalty_ledger (user_id, order_id, points, amount_vnd, source_type, source_key, actor_user_id, note)
    values (v_user_id, v_order.id, -v_points, v_points, 'order_payment_debit', 'order:' || v_order.id::text || ':points_debit', v_actor_id,
      case when v_admin_mode then 'Nhân viên tạo đơn tại quầy, đã xác nhận đồng ý dùng điểm: ' || v_consent_note else 'Điểm dùng thanh toán đơn hàng' end)
    on conflict (source_key) do nothing;
  end if;
  return query select v_order.id, v_order.order_number, v_order.subtotal_vnd, v_order.discount_vnd, v_order.total_vnd, v_order.points_applied, v_order.cash_due_vnd, v_order.receipt_token, v_fingerprint;
end;
$$;

create or replace function public.guard_blocked_member_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null
    and exists (
      select 1 from public.profiles
      where id = new.user_id and role = 'member' and membership_status = 'blocked'
    ) then
    raise exception 'MEMBER_BLOCKED';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_guard_blocked_member on public.orders;
create trigger orders_guard_blocked_member
before insert or update of user_id on public.orders
for each row execute function public.guard_blocked_member_order();

create function public.operator_create_counter_order(
  p_idempotency_key uuid, p_target_member_id uuid, p_customer_name text, p_customer_phone text,
  p_fulfillment public.order_fulfillment, p_pickup_at timestamptz, p_delivery_address text, p_note text,
  p_payment_method public.order_payment_method, p_voucher_code text, p_items jsonb, p_points_to_apply integer,
  p_points_consent_confirmed boolean, p_points_consent_note text,
  p_voucher_consent_confirmed boolean, p_voucher_consent_note text
)
returns table (order_id uuid, order_number bigint, subtotal_vnd integer, discount_vnd integer, total_vnd integer, points_applied integer, cash_due_vnd integer, receipt_token uuid, status public.order_status, payment_status public.order_payment_status)
language plpgsql
security definer
set search_path = ''
as $$
declare v_result record; v_actor uuid := (select auth.uid());
begin
  if (select public.current_user_role()) not in ('admin', 'staff') then raise exception 'OPERATOR_REQUIRED'; end if;
  if p_target_member_id is not null and not exists (select 1 from public.profiles where id = p_target_member_id and role = 'member' and membership_status <> 'blocked') then raise exception 'TARGET_MEMBER_REQUIRED'; end if;
  if coalesce(p_points_to_apply, 0) > 0 and (not coalesce(p_points_consent_confirmed, false) or char_length(trim(coalesce(p_points_consent_note, ''))) not between 10 and 300) then raise exception 'POINTS_CONSENT_REQUIRED'; end if;
  if coalesce(p_points_to_apply, 0) = 0 and p_points_consent_note is not null then raise exception 'INVALID_POINTS_CONSENT'; end if;
  if p_target_member_id is not null and nullif(upper(trim(p_voucher_code)), '') is not null
    and (not coalesce(p_voucher_consent_confirmed, false) or char_length(trim(coalesce(p_voucher_consent_note, ''))) not between 10 and 300) then
    raise exception 'VOUCHER_CONSENT_REQUIRED';
  end if;
  if nullif(upper(trim(p_voucher_code)), '') is null and p_voucher_consent_note is not null then raise exception 'INVALID_VOUCHER_CONSENT'; end if;
  perform pg_catalog.set_config('beanbus.order_creation_mode', 'pos', true);
  perform pg_catalog.set_config('beanbus.operator_entry', 'true', true);
  perform pg_catalog.set_config('beanbus.order_target_user_id', coalesce(p_target_member_id::text, ''), true);
  perform pg_catalog.set_config('beanbus.order_points_consent', case when coalesce(p_points_consent_confirmed, false) then 'true' else 'false' end, true);
  perform pg_catalog.set_config('beanbus.order_points_consent_note', trim(coalesce(p_points_consent_note, '')), true);
  select * into v_result from public.create_server_priced_order_v2(
    p_idempotency_key, p_customer_name, p_customer_phone, p_fulfillment, p_pickup_at, p_delivery_address, p_note,
    p_payment_method, p_voucher_code, p_items, coalesce(p_points_to_apply, 0)
  );
  insert into public.admin_order_creation_audit (
    order_id, actor_user_id, target_user_id, points_consent_confirmed, points_consent_note,
    voucher_consent_confirmed, voucher_consent_note
  ) values (
    v_result.order_id, v_actor, p_target_member_id, coalesce(p_points_consent_confirmed, false),
    case when coalesce(p_points_to_apply, 0) > 0 then trim(p_points_consent_note) end,
    coalesce(p_voucher_consent_confirmed, false),
    case when nullif(upper(trim(p_voucher_code)), '') is not null then trim(p_voucher_consent_note) end
  )
  on conflict on constraint admin_order_creation_audit_pkey do nothing;
  return query select v_result.order_id, v_result.order_number, v_result.subtotal_vnd, v_result.discount_vnd, v_result.total_vnd,
    v_result.points_applied, v_result.cash_due_vnd, v_result.receipt_token, orders.status, orders.payment_status
  from public.orders where orders.id = v_result.order_id;
end;
$$;

create function public.operator_advance_order(p_order_id uuid)
returns table (updated_order_id uuid, updated_order_status public.order_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_next_status public.order_status;
  v_transition text;
  v_role public.app_role := (select public.current_user_role());
begin
  if v_role not in ('admin', 'staff') then raise exception 'OPERATOR_REQUIRED'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.created_via <> 'pos' then raise exception 'POS_ORDER_REQUIRED'; end if;
  v_next_status := case v_order.status
    when 'pending' then 'confirmed'::public.order_status
    when 'confirmed' then 'preparing'::public.order_status
    when 'preparing' then 'ready'::public.order_status
    when 'ready' then 'completed'::public.order_status
    else null
  end;
  if v_next_status is null then raise exception 'INVALID_OPERATOR_TRANSITION'; end if;
  if v_order.payment_method = 'sepay_qr' and v_order.payment_status <> 'paid' and v_order.status = 'pending' then raise exception 'PAYMENT_REQUIRED'; end if;
  v_transition := v_order.status::text || ':' || v_next_status::text;
  if v_transition not in ('pending:confirmed', 'confirmed:preparing', 'preparing:ready', 'ready:completed') then raise exception 'INVALID_OPERATOR_TRANSITION'; end if;
  update public.orders set status = v_next_status, payment_status = case when v_next_status = 'completed' and v_order.payment_method = 'cod' then 'paid'::public.order_payment_status else payment_status end where id = v_order.id;
  return query select v_order.id, v_next_status;
end;
$$;

-- Voucher wallet: claim is not a quota reservation. Checkout remains the only quota lock.
create table if not exists public.voucher_wallet_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  voucher_code text not null references public.vouchers (code) on delete restrict,
  source text not null check (source in ('manual_claim', 'admin_grant', 'reward')),
  claimed_at timestamptz not null default now(),
  used_order_id uuid,
  used_at timestamptz,
  created_by_user_id uuid references auth.users (id) on delete set null,
  consent_confirmed boolean not null default false,
  consent_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint voucher_wallet_entries_user_voucher_key unique (user_id, voucher_code)
);

alter table public.voucher_wallet_entries
  add column if not exists consent_confirmed boolean not null default false,
  add column if not exists consent_note text;

alter table public.voucher_wallet_entries
  drop constraint if exists voucher_wallet_consent_note_check,
  drop constraint if exists voucher_wallet_consent_consistency_check,
  add constraint voucher_wallet_consent_note_check
  check (consent_note is null or char_length(consent_note) between 10 and 300),
  add constraint voucher_wallet_consent_consistency_check
  check (consent_confirmed or consent_note is null);

alter table public.voucher_wallet_entries enable row level security;
revoke all on table public.voucher_wallet_entries from anon, authenticated;
grant select on table public.voucher_wallet_entries to authenticated;
grant all on table public.voucher_wallet_entries to service_role;
create policy "Members read their voucher wallet"
on public.voucher_wallet_entries for select to authenticated
using (user_id = (select auth.uid()) or (select public.current_user_role()) = 'admin');
create index if not exists voucher_wallet_user_idx on public.voucher_wallet_entries (user_id, claimed_at desc);
create index if not exists voucher_wallet_active_idx on public.voucher_wallet_entries (user_id, used_order_id) where used_order_id is null;
create trigger voucher_wallet_set_updated_at before update on public.voucher_wallet_entries for each row execute function public.set_updated_at();

create or replace function public.sync_assigned_voucher_wallet()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.assigned_user_id is not null then
    insert into public.voucher_wallet_entries (user_id, voucher_code, source)
    values (new.assigned_user_id, new.code, 'admin_grant')
    on conflict on constraint voucher_wallet_entries_user_voucher_key do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists vouchers_sync_wallet on public.vouchers;
create trigger vouchers_sync_wallet after insert or update of assigned_user_id on public.vouchers for each row execute function public.sync_assigned_voucher_wallet();
insert into public.voucher_wallet_entries (user_id, voucher_code, source)
select assigned_user_id, code, 'admin_grant'
from public.vouchers where assigned_user_id is not null
on conflict on constraint voucher_wallet_entries_user_voucher_key do nothing;

create function public.claim_voucher(p_voucher_code text)
returns table (voucher_code text, claimed boolean)
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_code text := upper(trim(coalesce(p_voucher_code, ''))); v_voucher public.vouchers%rowtype;
begin
  if v_user is null or (select public.current_user_role()) is distinct from 'member' then raise exception 'MEMBER_REQUIRED'; end if;
  if exists (select 1 from public.profiles where id = v_user and membership_status = 'blocked') then raise exception 'MEMBER_BLOCKED'; end if;
  select * into v_voucher from public.vouchers where code = v_code for update;
  if not found or v_voucher.assigned_user_id is not null or not v_voucher.is_active
    or (v_voucher.starts_at is not null and now() < v_voucher.starts_at)
    or (v_voucher.ends_at is not null and now() >= v_voucher.ends_at)
    or (v_voucher.usage_limit is not null and v_voucher.usage_count >= v_voucher.usage_limit) then raise exception 'INVALID_VOUCHER'; end if;
  insert into public.voucher_wallet_entries (user_id, voucher_code, source) values (v_user, v_code, 'manual_claim') on conflict on constraint voucher_wallet_entries_user_voucher_key do nothing;
  return query select v_code, true;
end;
$$;

drop function if exists public.operator_claim_member_voucher(uuid, text);
create function public.operator_claim_member_voucher(p_member_id uuid, p_voucher_code text, p_consent_confirmed boolean, p_consent_note text)
returns table (voucher_code text, claimed boolean)
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_code text := upper(trim(coalesce(p_voucher_code, ''))); v_voucher public.vouchers%rowtype;
begin
  if (select public.current_user_role()) not in ('admin', 'staff') then raise exception 'OPERATOR_REQUIRED'; end if;
  if not coalesce(p_consent_confirmed, false)
    or char_length(trim(coalesce(p_consent_note, ''))) not between 10 and 300 then
    raise exception 'VOUCHER_CONSENT_REQUIRED';
  end if;
  if not exists (select 1 from public.profiles where id = p_member_id and role = 'member' and membership_status <> 'blocked') then raise exception 'TARGET_MEMBER_REQUIRED'; end if;
  select * into v_voucher from public.vouchers where code = v_code for update;
  if not found or v_voucher.assigned_user_id is not null or not v_voucher.is_active
    or (v_voucher.starts_at is not null and now() < v_voucher.starts_at)
    or (v_voucher.ends_at is not null and now() >= v_voucher.ends_at)
    or (v_voucher.usage_limit is not null and v_voucher.usage_count >= v_voucher.usage_limit) then raise exception 'INVALID_VOUCHER'; end if;
  insert into public.voucher_wallet_entries (
    user_id, voucher_code, source, created_by_user_id, consent_confirmed, consent_note
  ) values (
    p_member_id, v_code, 'admin_grant', v_actor, true, trim(p_consent_note)
  ) on conflict on constraint voucher_wallet_entries_user_voucher_key do nothing;
  return query select v_code, true;
end;
$$;

create function public.admin_distribute_voucher(p_voucher_code text, p_member_ids uuid[])
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if (select public.current_user_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if not exists (select 1 from public.vouchers where code = upper(trim(p_voucher_code)) and assigned_user_id is null) then raise exception 'INVALID_VOUCHER'; end if;
  insert into public.voucher_wallet_entries (user_id, voucher_code, source, created_by_user_id)
  select p.id, upper(trim(p_voucher_code)), 'admin_grant', (select auth.uid()) from public.profiles p where p.id = any(p_member_ids) and p.role = 'member'
  on conflict on constraint voucher_wallet_entries_user_voucher_key do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.guard_order_voucher_wallet()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_entry public.voucher_wallet_entries%rowtype; v_voucher public.vouchers%rowtype;
begin
  if new.user_id is null or new.voucher_code is null then return new; end if;
  select * into v_voucher from public.vouchers where code = new.voucher_code for update;
  if not found then return new; end if;
  if v_voucher.assigned_user_id is not null and v_voucher.assigned_user_id is distinct from new.user_id then raise exception 'VOUCHER_NOT_OWNED'; end if;
  insert into public.voucher_wallet_entries (user_id, voucher_code, source)
  values (new.user_id, new.voucher_code, case when v_voucher.assigned_user_id is null then 'manual_claim' else 'reward' end)
  on conflict on constraint voucher_wallet_entries_user_voucher_key do nothing;
  select * into v_entry from public.voucher_wallet_entries where user_id = new.user_id and voucher_code = new.voucher_code for update;
  if v_entry.used_order_id is not null then raise exception 'VOUCHER_ALREADY_USED'; end if;
  update public.voucher_wallet_entries set used_order_id = new.id, used_at = now(), updated_at = now() where id = v_entry.id;
  return new;
end;
$$;
drop trigger if exists orders_guard_voucher_wallet on public.orders;
create trigger orders_guard_voucher_wallet before insert on public.orders for each row execute function public.guard_order_voucher_wallet();

create or replace function public.release_order_voucher_wallet()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_policy text;
begin
  if new.status = 'cancelled' and old.status is distinct from new.status and new.user_id is not null and new.voucher_code is not null then
    select case when old.payment_status = 'paid' then voucher_on_refund else voucher_on_cancel end into v_policy from public.commerce_policy where id;
    if v_policy = 'release' then update public.voucher_wallet_entries set used_order_id = null, used_at = null, updated_at = now() where user_id = new.user_id and voucher_code = new.voucher_code and used_order_id = new.id; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists orders_release_voucher_wallet on public.orders;
create trigger orders_release_voucher_wallet after update of status on public.orders for each row execute function public.release_order_voucher_wallet();

create table if not exists private.member_pass_nonces (
  nonce_hash text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists member_pass_active_user_idx
on private.member_pass_nonces (user_id)
where used_at is null;
revoke all on table private.member_pass_nonces from public, anon, authenticated, service_role;

create function public.issue_member_pass_nonce(p_nonce_hash text, p_expires_at timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if (select public.current_user_role()) is distinct from 'member' then raise exception 'MEMBER_REQUIRED'; end if;
  if exists (select 1 from public.profiles where id = (select auth.uid()) and membership_status = 'blocked') then raise exception 'MEMBER_BLOCKED'; end if;
  if p_nonce_hash is null or p_nonce_hash !~ '^[0-9a-f]{64}$' or p_expires_at <= now() or p_expires_at > now() + interval '10 minutes' then raise exception 'INVALID_MEMBER_PASS'; end if;
  perform pg_advisory_xact_lock(pg_catalog.hashtextextended('beanbus:member-pass:' || (select auth.uid())::text, 0));
  delete from private.member_pass_nonces where user_id = (select auth.uid()) and used_at is null;
  insert into private.member_pass_nonces (nonce_hash, user_id, expires_at) values (p_nonce_hash, (select auth.uid()), p_expires_at);
  return true;
end;
$$;

create function public.consume_member_pass_nonce(p_nonce_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if (select public.current_user_role()) not in ('admin', 'staff') then raise exception 'OPERATOR_REQUIRED'; end if;
  update private.member_pass_nonces set used_at = now()
  where nonce_hash = p_nonce_hash and used_at is null and expires_at > now()
    and exists (
      select 1 from public.profiles p
      where p.id = private.member_pass_nonces.user_id
        and p.role = 'member'
        and p.membership_status <> 'blocked'
    )
  returning user_id into v_user;
  if v_user is null then raise exception 'INVALID_MEMBER_PASS'; end if;
  return v_user;
end;
$$;

create or replace function private.cleanup_member_pass_nonces()
returns bigint language sql security definer set search_path = '' as $$
  with deleted as (delete from private.member_pass_nonces where expires_at < now() - interval '1 day' returning 1) select count(*) from deleted;
$$;

revoke all on function public.operator_register_pending_member(uuid, text, text) from public, anon;
revoke all on function public.operator_search_members(text, integer) from public, anon;
revoke all on function public.operator_create_counter_order(uuid, uuid, text, text, public.order_fulfillment, timestamptz, text, text, public.order_payment_method, text, jsonb, integer, boolean, text, boolean, text) from public, anon;
revoke all on function public.operator_advance_order(uuid) from public, anon;
revoke all on function public.claim_voucher(text) from public, anon;
revoke all on function public.operator_claim_member_voucher(uuid, text, boolean, text) from public, anon;
revoke all on function public.admin_distribute_voucher(text, uuid[]) from public, anon;
revoke all on function public.issue_member_pass_nonce(text, timestamptz) from public, anon;
revoke all on function public.consume_member_pass_nonce(text) from public, anon;
grant execute on function public.operator_register_pending_member(uuid, text, text) to authenticated;
grant execute on function public.operator_search_members(text, integer) to authenticated;
grant execute on function public.operator_create_counter_order(uuid, uuid, text, text, public.order_fulfillment, timestamptz, text, text, public.order_payment_method, text, jsonb, integer, boolean, text, boolean, text) to authenticated;
grant execute on function public.operator_advance_order(uuid) to authenticated;
grant execute on function public.claim_voucher(text) to authenticated;
grant execute on function public.operator_claim_member_voucher(uuid, text, boolean, text) to authenticated;
grant execute on function public.admin_distribute_voucher(text, uuid[]) to authenticated;
grant execute on function public.issue_member_pass_nonce(text, timestamptz) to authenticated;
grant execute on function public.consume_member_pass_nonce(text) to authenticated;

select cron.schedule('beanbus-clean-member-pass-nonces', '17 3 * * *', 'select private.cleanup_member_pass_nonces()')
where not exists (select 1 from cron.job where jobname = 'beanbus-clean-member-pass-nonces');
