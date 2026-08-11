alter table public.payments drop constraint payments_payment_code_check;

alter table public.payments add constraint payments_payment_code_check
check (payment_code ~ '^(DH_[0-9]+|BB[0-9]+)$');

create or replace function public.create_sepay_payment(
  p_order_id uuid,
  p_receipt_token uuid,
  p_bank_code text,
  p_account_number text
)
returns table (
  payment_id uuid,
  payment_code text,
  amount_vnd integer,
  payment_status text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
begin
  select * into v_order from public.orders
  where id = p_order_id and receipt_token = p_receipt_token
  for update;

  if not found or v_order.payment_method <> 'sepay_qr' then
    raise exception 'ORDER_NOT_ELIGIBLE';
  end if;
  if char_length(trim(p_bank_code)) not between 2 and 32
    or char_length(trim(p_account_number)) not between 4 and 64 then
    raise exception 'INVALID_PAYMENT_DESTINATION';
  end if;

  insert into public.payments (
    order_id, payment_code, amount_vnd, bank_code, account_number, expires_at
  ) values (
    v_order.id, 'DH_' || v_order.order_number, v_order.total_vnd,
    trim(p_bank_code), trim(p_account_number), now() + interval '30 minutes'
  ) on conflict (order_id) do nothing;

  select * into strict v_payment from public.payments where order_id = v_order.id;
  return query select v_payment.id, v_payment.payment_code, v_payment.amount_vnd,
    v_payment.status, v_payment.expires_at;
end;
$$;

revoke all on function public.create_sepay_payment(uuid, uuid, text, text) from public;
grant execute on function public.create_sepay_payment(uuid, uuid, text, text) to service_role;
