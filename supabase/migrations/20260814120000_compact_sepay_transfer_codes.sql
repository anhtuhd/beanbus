begin;

-- SePay transfer memos must not contain separators. Keep the display order
-- code human-readable, but store stored-value payment codes in compact form.
alter table public.stored_value_payments
  drop constraint if exists stored_value_payments_payment_code_check;

update public.stored_value_payments
set payment_code = upper(replace(payment_code, '-', ''))
where payment_code ~* '^DH-(TP|FS)-[A-F0-9]{20}$';

alter table public.stored_value_payments
  add constraint stored_value_payments_payment_code_check
  check (payment_code ~* '^(B[TF][0-9]+|DHTP[A-F0-9]{20}|DHFS[A-F0-9]{20})$');

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
      if v_existing.status = 'pending' and v_existing.payment_code ~* '^B[TF][0-9]+$' then
        v_prefix := 'DHTP';
        v_expires_at := v_topup.expires_at;
        loop
          v_payment_code := v_prefix || upper(encode(extensions.gen_random_bytes(10), 'hex'));
          update public.stored_value_payments
          set payment_code = v_payment_code
          where id = v_existing.id
            and not exists (
              select 1
              from public.stored_value_payments existing
              where existing.payment_code = v_payment_code
            );
          exit when found;
        end loop;
        select * into v_existing from public.stored_value_payments where id = v_existing.id;
      end if;
      return query select v_existing.id, v_existing.payment_code, v_existing.amount_vnd, v_existing.status, v_existing.expires_at;
      return;
    end if;
    if v_topup.status <> 'pending' or v_topup.expires_at <= now() then raise exception 'TOPUP_NOT_PAYABLE'; end if;
    v_prefix := 'DHTP';
    v_amount := v_topup.amount_vnd;
    v_expires_at := v_topup.expires_at;
  else
    select * into v_flash from public.flash_sale_purchases where id = p_purchase_id for update;
    if not found then raise exception 'FLASH_SALE_NOT_PAYABLE'; end if;
    select * into v_existing from public.stored_value_payments where flash_sale_purchase_id = v_flash.id;
    if v_existing.id is not null then
      if v_existing.status = 'pending' and v_existing.payment_code ~* '^B[TF][0-9]+$' then
        v_prefix := 'DHFS';
        v_expires_at := v_flash.expires_at;
        loop
          v_payment_code := v_prefix || upper(encode(extensions.gen_random_bytes(10), 'hex'));
          update public.stored_value_payments
          set payment_code = v_payment_code
          where id = v_existing.id
            and not exists (
              select 1
              from public.stored_value_payments existing
              where existing.payment_code = v_payment_code
            );
          exit when found;
        end loop;
        select * into v_existing from public.stored_value_payments where id = v_existing.id;
      end if;
      return query select v_existing.id, v_existing.payment_code, v_existing.amount_vnd, v_existing.status, v_existing.expires_at;
      return;
    end if;
    if v_flash.status <> 'pending' or v_flash.expires_at <= now() then raise exception 'FLASH_SALE_NOT_PAYABLE'; end if;
    v_prefix := 'DHFS';
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

revoke all on function public.create_stored_value_payment(text, uuid, text, text) from public;
grant execute on function public.create_stored_value_payment(text, uuid, text, text) to service_role;

commit;
