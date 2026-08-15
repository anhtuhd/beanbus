-- Correct counter-member profile creation and make voucher claim results truthful.

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
    case when new.phone_confirmed_at is null then new.phone else null end,
    case when new.phone_confirmed_at is null and new.phone is not null then 'pending'::public.membership_status else 'active'::public.membership_status end,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.claim_voucher(p_voucher_code text)
returns table (voucher_code text, claimed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_code text := upper(trim(coalesce(p_voucher_code, '')));
  v_voucher public.vouchers%rowtype;
  v_entry public.voucher_wallet_entries%rowtype;
  v_claimed boolean := false;
begin
  if v_user is null or (select public.current_user_role()) is distinct from 'member' then raise exception 'MEMBER_REQUIRED'; end if;
  if exists (select 1 from public.profiles where id = v_user and membership_status = 'blocked') then raise exception 'MEMBER_BLOCKED'; end if;

  select * into v_voucher from public.vouchers where code = v_code for update;
  if not found or v_voucher.assigned_user_id is not null or not v_voucher.is_active
    or (v_voucher.starts_at is not null and now() < v_voucher.starts_at)
    or (v_voucher.ends_at is not null and now() >= v_voucher.ends_at)
    or (v_voucher.usage_limit is not null and v_voucher.usage_count >= v_voucher.usage_limit) then
    raise exception 'INVALID_VOUCHER';
  end if;

  insert into public.voucher_wallet_entries (user_id, voucher_code, source)
  values (v_user, v_code, 'manual_claim')
  on conflict on constraint voucher_wallet_entries_user_voucher_key do nothing
  returning true into v_claimed;

  if not coalesce(v_claimed, false) then
    select * into v_entry
    from public.voucher_wallet_entries as wallet_entry
    where wallet_entry.user_id = v_user and wallet_entry.voucher_code = v_code
    for update;
    if v_entry.used_order_id is not null then raise exception 'VOUCHER_ALREADY_USED'; end if;
  end if;

  return query select v_code, coalesce(v_claimed, false);
end;
$$;

create or replace function public.operator_claim_member_voucher(
  p_member_id uuid,
  p_voucher_code text,
  p_consent_confirmed boolean,
  p_consent_note text
)
returns table (voucher_code text, claimed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_code text := upper(trim(coalesce(p_voucher_code, '')));
  v_voucher public.vouchers%rowtype;
  v_entry public.voucher_wallet_entries%rowtype;
  v_claimed boolean := false;
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
    or (v_voucher.usage_limit is not null and v_voucher.usage_count >= v_voucher.usage_limit) then
    raise exception 'INVALID_VOUCHER';
  end if;

  insert into public.voucher_wallet_entries (
    user_id, voucher_code, source, created_by_user_id, consent_confirmed, consent_note
  ) values (
    p_member_id, v_code, 'admin_grant', v_actor, true, trim(p_consent_note)
  ) on conflict on constraint voucher_wallet_entries_user_voucher_key do nothing
  returning true into v_claimed;

  if not coalesce(v_claimed, false) then
    select * into v_entry
    from public.voucher_wallet_entries as wallet_entry
    where wallet_entry.user_id = p_member_id and wallet_entry.voucher_code = v_code
    for update;
    if v_entry.used_order_id is not null then raise exception 'VOUCHER_ALREADY_USED'; end if;
  end if;

  return query select v_code, coalesce(v_claimed, false);
end;
$$;
