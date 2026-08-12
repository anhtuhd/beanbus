alter table public.orders add column order_code text;

create or replace function public.generate_order_code(p_created_at timestamptz)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  loop
    v_code := 'DH-' || to_char(coalesce(p_created_at, now()) at time zone 'Asia/Ho_Chi_Minh', 'YYMMDD')
      || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 6));
    exit when not exists (
      select 1 from public.orders as existing where existing.order_code = v_code
    );
  end loop;
  return v_code;
end;
$$;

update public.orders
set order_code = public.generate_order_code(created_at)
where order_code is null;

alter table public.orders
  alter column order_code set default public.generate_order_code(now()),
  alter column order_code set not null;

alter table public.orders add constraint orders_order_code_key unique (order_code);
alter table public.orders add constraint orders_order_code_format_check
check (order_code ~ '^DH-[0-9]{6}[A-Za-z0-9]{6}$');

revoke all on function public.generate_order_code(timestamptz) from public, anon, authenticated;

alter table public.payments drop constraint payments_payment_code_check;

update public.payments
set payment_code = orders.order_code
from public.orders
where payments.order_id = orders.id;

alter table public.payments add constraint payments_payment_code_check
check (payment_code ~ '^DH-[0-9]{6}[A-Za-z0-9]{6}$');

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
  select * into v_order
  from public.orders
  where id = p_order_id and receipt_token = p_receipt_token
  for update;

  if not found
    or v_order.payment_method <> 'sepay_qr'
    or v_order.status <> 'pending'
    or v_order.payment_status <> 'pending' then
    raise exception 'ORDER_NOT_ELIGIBLE';
  end if;
  if char_length(trim(p_bank_code)) not between 2 and 32
    or char_length(trim(p_account_number)) not between 4 and 64 then
    raise exception 'INVALID_PAYMENT_DESTINATION';
  end if;

  insert into public.payments (
    order_id, payment_code, amount_vnd, bank_code, account_number, expires_at
  ) values (
    v_order.id, v_order.order_code, v_order.total_vnd,
    trim(p_bank_code), trim(p_account_number), now() + interval '15 minutes'
  ) on conflict (order_id) do nothing;

  select * into strict v_payment from public.payments where order_id = v_order.id;
  return query select v_payment.id, v_payment.payment_code, v_payment.amount_vnd,
    v_payment.status, v_payment.expires_at;
end;
$$;

create or replace function public.expire_pending_sepay_payments()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired integer;
  v_abandoned integer;
begin
  update public.payments
  set status = 'expired', updated_at = now()
  where status = 'pending' and expires_at <= now();
  get diagnostics v_expired = row_count;

  -- The payment status trigger marks linked orders as failed before this update.
  update public.orders as orders
  set status = 'cancelled', payment_status = 'failed', updated_at = now()
  where orders.payment_method = 'sepay_qr'
    and orders.payment_status in ('pending', 'failed')
    and orders.status = 'pending'
    and exists (
      select 1 from public.payments as payment
      where payment.order_id = orders.id
        and payment.status = 'expired'
        and payment.expires_at <= now()
    );

  update public.orders as orders
  set status = 'cancelled', payment_status = 'failed', updated_at = now()
  where orders.payment_method = 'sepay_qr'
    and orders.payment_status in ('pending', 'failed')
    and orders.status = 'pending'
    and not exists (
      select 1 from public.payments as payment where payment.order_id = orders.id
    )
    and orders.created_at <= now() - interval '15 minutes';
  get diagnostics v_abandoned = row_count;

  return v_expired + v_abandoned;
end;
$$;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'beanbus-expire-sepay-payments') then
    perform cron.schedule(
      'beanbus-expire-sepay-payments',
      '* * * * *',
      'select public.expire_pending_sepay_payments()'
    );
  end if;
end;
$$;

create or replace function public.get_order_receipt(p_order_id uuid, p_receipt_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', orders.id,
    'number', orders.order_number,
    'orderCode', orders.order_code,
    'customerName', orders.customer_name,
    'customerPhone', orders.customer_phone,
    'fulfillment', orders.fulfillment,
    'pickupAt', orders.pickup_at,
    'deliveryAddress', orders.delivery_address,
    'note', orders.note,
    'subtotalVnd', orders.subtotal_vnd,
    'discountVnd', orders.discount_vnd,
    'totalVnd', orders.total_vnd,
    'paymentMethod', orders.payment_method,
    'paymentStatus', orders.payment_status,
    'status', orders.status,
    'createdAt', orders.created_at,
    'payment', (
      select jsonb_build_object(
        'code', payments.payment_code,
        'status', payments.status,
        'expiresAt', payments.expires_at,
        'bankCode', payments.bank_code,
        'accountNumber', payments.account_number
      ) from public.payments where payments.order_id = orders.id
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', order_items.id,
        'productId', order_items.product_id,
        'nameVi', order_items.product_name_vi,
        'nameEn', order_items.product_name_en,
        'imageUrl', order_items.image_url,
        'quantity', order_items.quantity,
        'unitPriceVnd', order_items.unit_price_vnd,
        'lineTotalVnd', order_items.line_total_vnd,
        'specialNote', order_items.special_note,
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', order_item_options.option_id,
            'nameVi', order_item_options.option_name_vi,
            'nameEn', order_item_options.option_name_en,
            'extraPriceVnd', order_item_options.extra_price_vnd
          ) order by order_item_options.option_id)
          from public.order_item_options
          where order_item_options.order_item_id = order_items.id
        ), '[]'::jsonb)
      ) order by order_items.created_at, order_items.id)
      from public.order_items
      where order_items.order_id = orders.id
    ), '[]'::jsonb)
  )
  from public.orders
  where orders.id = p_order_id
    and orders.receipt_token = p_receipt_token
$$;
