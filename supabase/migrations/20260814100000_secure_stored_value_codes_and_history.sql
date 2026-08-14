begin;

-- Keep legacy BT/BF codes readable while all new stored-value payments use a
-- DH-prefixed random code so SePay's webhook filter can see them.
alter table public.stored_value_payments
  drop constraint if exists stored_value_payments_payment_code_check;

alter table public.stored_value_payments
  add constraint stored_value_payments_payment_code_check
  check (payment_code ~* '^(B[TF][0-9]+|DH-(TP|FS)-[A-F0-9]{20})$');

-- Pending legacy payments must also receive a DH code because SePay only
-- invokes this webhook for transfers whose content contains "DH".
do $$
declare
  v_payment public.stored_value_payments%rowtype;
  v_new_code text;
begin
  for v_payment in
    select *
    from public.stored_value_payments
    where status = 'pending'
      and payment_code ~* '^B[TF][0-9]+$'
    order by id
    for update
  loop
    loop
      v_new_code := case
        when v_payment.topup_id is not null then 'DH-TP-'
        else 'DH-FS-'
      end || upper(encode(extensions.gen_random_bytes(10), 'hex'));

      update public.stored_value_payments
      set payment_code = v_new_code
      where id = v_payment.id
        and not exists (
          select 1
          from public.stored_value_payments existing
          where existing.payment_code = v_new_code
        );

      exit when found;
    end loop;
  end loop;
end;
$$;

create or replace function public.create_stored_value_payment(
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
    v_prefix := 'DH-TP-';
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
    v_prefix := 'DH-FS-';
    v_amount := v_flash.amount_vnd;
    v_expires_at := v_flash.expires_at;
  end if;

  loop
    v_payment_code := v_prefix || upper(encode(extensions.gen_random_bytes(10), 'hex'));
    insert into public.stored_value_payments (
      topup_id, flash_sale_purchase_id, payment_code, amount_vnd, bank_code, account_number, expires_at
    ) values (
      case when p_purchase_type = 'topup' then p_purchase_id else null end,
      case when p_purchase_type = 'flash_sale' then p_purchase_id else null end,
      v_payment_code, v_amount, trim(p_bank_code), trim(p_account_number), v_expires_at
    ) on conflict on constraint stored_value_payments_payment_code_key do nothing returning * into v_existing;
    exit when found;
  end loop;

  return query select v_existing.id, v_existing.payment_code, v_existing.amount_vnd, v_existing.status, v_existing.expires_at;
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
      coalesce(payments.status, topups.status) as status,
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
      coalesce(payments.status, purchases.status),
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

revoke all on function public.create_stored_value_payment(text, uuid, text, text) from public;
grant execute on function public.create_stored_value_payment(text, uuid, text, text) to service_role;
revoke all on function public.get_member_payment_history(integer, integer) from public;
grant execute on function public.get_member_payment_history(integer, integer) to authenticated;

commit;
