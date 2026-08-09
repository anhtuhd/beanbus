create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete restrict,
  provider text not null default 'sepay' check (provider = 'sepay'),
  payment_code text not null unique check (payment_code ~ '^BB[0-9]+$'),
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
  check ((status in ('paid', 'refunded')) = (paid_at is not null))
);

create table public.sepay_webhook_events (
  provider_transaction_id bigint primary key,
  payment_id uuid references public.payments (id) on delete set null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'rejected')),
  reason text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index payments_status_expires_idx on public.payments (status, expires_at);

alter table public.payments enable row level security;
alter table public.sepay_webhook_events enable row level security;

revoke all on table public.payments, public.sepay_webhook_events from anon, authenticated;
grant select on table public.payments to authenticated;
grant all on table public.payments, public.sepay_webhook_events to service_role;

create policy "Members read their payments"
on public.payments for select to authenticated
using (exists (
  select 1 from public.orders
  where orders.id = payments.order_id
    and (orders.user_id = (select auth.uid()) or (select public.current_user_role()) = 'admin')
));

create trigger payments_set_updated_at before update on public.payments
for each row execute function public.set_updated_at();

create function public.create_sepay_payment(
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
    v_order.id, 'BB' || v_order.order_number, v_order.total_vnd,
    trim(p_bank_code), trim(p_account_number), now() + interval '30 minutes'
  ) on conflict (order_id) do nothing;

  select * into strict v_payment from public.payments where order_id = v_order.id;
  return query select v_payment.id, v_payment.payment_code, v_payment.amount_vnd,
    v_payment.status, v_payment.expires_at;
end;
$$;

create function public.process_sepay_webhook(
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
returns table (outcome text, matched_order_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_inserted integer;
  v_existing_order_id uuid;
begin
  insert into public.sepay_webhook_events (provider_transaction_id, payload)
  values (p_provider_transaction_id, p_payload)
  on conflict (provider_transaction_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select payments.order_id into v_existing_order_id
    from public.sepay_webhook_events
    left join public.payments on payments.id = sepay_webhook_events.payment_id
    where sepay_webhook_events.provider_transaction_id = p_provider_transaction_id;
    return query select 'duplicate'::text, v_existing_order_id;
    return;
  end if;

  if p_transfer_type <> 'in' then
    update public.sepay_webhook_events set status = 'rejected', reason = 'NOT_INBOUND', processed_at = now()
    where provider_transaction_id = p_provider_transaction_id;
    return query select 'rejected'::text, null::uuid;
    return;
  end if;

  select * into v_payment from public.payments
  where payment_code = upper(p_code)
  for update;
  if not found then
    update public.sepay_webhook_events set status = 'rejected', reason = 'PAYMENT_NOT_FOUND', processed_at = now()
    where provider_transaction_id = p_provider_transaction_id;
    return query select 'rejected'::text, null::uuid;
    return;
  end if;

  update public.sepay_webhook_events set payment_id = v_payment.id
  where provider_transaction_id = p_provider_transaction_id;

  if p_account_number <> v_payment.account_number then
    update public.sepay_webhook_events set status = 'rejected', reason = 'ACCOUNT_MISMATCH', processed_at = now()
    where provider_transaction_id = p_provider_transaction_id;
    return query select 'rejected'::text, v_payment.order_id;
    return;
  end if;
  if p_transfer_amount <> v_payment.amount_vnd then
    update public.sepay_webhook_events set status = 'rejected', reason = 'AMOUNT_MISMATCH', processed_at = now()
    where provider_transaction_id = p_provider_transaction_id;
    return query select 'rejected'::text, v_payment.order_id;
    return;
  end if;
  if p_transaction_at < v_payment.created_at - interval '5 minutes'
    or p_transaction_at > v_payment.expires_at then
    update public.payments set status = 'expired' where id = v_payment.id and status = 'pending';
    update public.sepay_webhook_events set status = 'rejected', reason = 'PAYMENT_EXPIRED', processed_at = now()
    where provider_transaction_id = p_provider_transaction_id;
    return query select 'rejected'::text, v_payment.order_id;
    return;
  end if;
  if v_payment.status <> 'pending' then
    update public.sepay_webhook_events set status = 'rejected', reason = 'PAYMENT_NOT_PENDING', processed_at = now()
    where provider_transaction_id = p_provider_transaction_id;
    return query select 'rejected'::text, v_payment.order_id;
    return;
  end if;

  update public.payments set
    status = 'paid',
    provider_transaction_id = p_provider_transaction_id,
    provider_reference = nullif(trim(p_reference_code), ''),
    provider_payload = p_payload,
    paid_at = p_transaction_at
  where id = v_payment.id;

  update public.orders set
    payment_status = 'paid',
    status = case when status = 'pending' then 'confirmed' else status end
  where id = v_payment.order_id;

  update public.sepay_webhook_events set status = 'processed', processed_at = now()
  where provider_transaction_id = p_provider_transaction_id;

  return query select 'processed'::text, v_payment.order_id;
end;
$$;

revoke all on function public.create_sepay_payment(uuid, uuid, text, text) from public;
revoke all on function public.process_sepay_webhook(bigint, text, timestamptz, text, text, text, integer, text, jsonb) from public;
grant execute on function public.create_sepay_payment(uuid, uuid, text, text) to service_role;
grant execute on function public.process_sepay_webhook(bigint, text, timestamptz, text, text, text, integer, text, jsonb) to service_role;

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
