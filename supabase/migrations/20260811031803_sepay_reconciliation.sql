alter table public.payments
  add column provider_transaction_key text
  check (provider_transaction_key is null or char_length(provider_transaction_key) between 1 and 128);

create unique index payments_provider_transaction_key_idx
on public.payments (provider_transaction_key)
where provider_transaction_key is not null;

create table public.sepay_reconciliation_events (
  provider_transaction_key text primary key check (char_length(provider_transaction_key) between 1 and 128),
  payment_id uuid references public.payments (id) on delete set null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'rejected')),
  reason text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.sepay_reconciliation_state (
  id boolean primary key default true check (id),
  cursor_at timestamptz,
  cursor_key text,
  lease_key uuid,
  lease_until timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.sepay_reconciliation_state (id)
values (true)
on conflict (id) do nothing;

alter table public.sepay_reconciliation_events enable row level security;
alter table public.sepay_reconciliation_state enable row level security;
revoke all on table public.sepay_reconciliation_events, public.sepay_reconciliation_state from anon, authenticated;
grant all on table public.sepay_reconciliation_events, public.sepay_reconciliation_state to service_role;

create function public.process_sepay_reconciliation(
  p_provider_transaction_key text,
  p_gateway text,
  p_transaction_at timestamptz,
  p_account_number text,
  p_code text,
  p_transfer_type text,
  p_transfer_amount integer,
  p_reference_code text,
  p_content text,
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
  if p_provider_transaction_key is null
    or char_length(trim(p_provider_transaction_key)) not between 1 and 128
    or p_gateway is null
    or char_length(trim(p_gateway)) not between 1 and 100
    or p_transaction_at is null
    or p_account_number is null
    or char_length(trim(p_account_number)) not between 4 and 64
    or p_code is null
    or char_length(trim(p_code)) not between 1 and 64
    or p_transfer_amount is null
    or p_transfer_amount < 1
    or p_payload is null then
    raise exception 'INVALID_RECONCILIATION_EVENT';
  end if;

  insert into public.sepay_reconciliation_events (provider_transaction_key, payload)
  values (trim(p_provider_transaction_key), p_payload)
  on conflict (provider_transaction_key) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select payments.order_id into v_existing_order_id
    from public.sepay_reconciliation_events as events
    left join public.payments on payments.id = events.payment_id
    where events.provider_transaction_key = trim(p_provider_transaction_key);
    return query select 'duplicate'::text, v_existing_order_id;
    return;
  end if;

  if p_transfer_type <> 'in' then
    update public.sepay_reconciliation_events
    set status = 'rejected', reason = 'NOT_INBOUND', processed_at = now()
    where provider_transaction_key = trim(p_provider_transaction_key);
    return query select 'rejected'::text, null::uuid;
    return;
  end if;

  select * into v_payment
  from public.payments
  where payment_code = upper(trim(p_code))
  for update;
  if not found then
    update public.sepay_reconciliation_events
    set status = 'rejected', reason = 'PAYMENT_NOT_FOUND', processed_at = now()
    where provider_transaction_key = trim(p_provider_transaction_key);
    return query select 'rejected'::text, null::uuid;
    return;
  end if;

  update public.sepay_reconciliation_events
  set payment_id = v_payment.id
  where provider_transaction_key = trim(p_provider_transaction_key);

  if p_account_number <> v_payment.account_number then
    update public.sepay_reconciliation_events
    set status = 'rejected', reason = 'ACCOUNT_MISMATCH', processed_at = now()
    where provider_transaction_key = trim(p_provider_transaction_key);
    return query select 'rejected'::text, v_payment.order_id;
    return;
  end if;
  if p_transfer_amount <> v_payment.amount_vnd then
    update public.sepay_reconciliation_events
    set status = 'rejected', reason = 'AMOUNT_MISMATCH', processed_at = now()
    where provider_transaction_key = trim(p_provider_transaction_key);
    return query select 'rejected'::text, v_payment.order_id;
    return;
  end if;
  if p_transaction_at < v_payment.created_at - interval '5 minutes'
    or p_transaction_at > v_payment.expires_at then
    update public.payments set status = 'expired' where id = v_payment.id and status = 'pending';
    update public.sepay_reconciliation_events
    set status = 'rejected', reason = 'PAYMENT_EXPIRED', processed_at = now()
    where provider_transaction_key = trim(p_provider_transaction_key);
    return query select 'rejected'::text, v_payment.order_id;
    return;
  end if;
  if v_payment.status <> 'pending' then
    update public.sepay_reconciliation_events
    set status = 'rejected', reason = 'PAYMENT_NOT_PENDING', processed_at = now()
    where provider_transaction_key = trim(p_provider_transaction_key);
    return query select 'rejected'::text, v_payment.order_id;
    return;
  end if;

  update public.payments
  set status = 'paid',
    provider_transaction_key = trim(p_provider_transaction_key),
    provider_reference = nullif(trim(p_reference_code), ''),
    provider_payload = p_payload,
    paid_at = p_transaction_at
  where id = v_payment.id;

  update public.orders
  set payment_status = 'paid',
    status = case when status = 'pending' then 'confirmed' else status end
  where id = v_payment.order_id;

  update public.sepay_reconciliation_events
  set status = 'processed', processed_at = now()
  where provider_transaction_key = trim(p_provider_transaction_key);

  return query select 'processed'::text, v_payment.order_id;
end;
$$;

create function public.acquire_sepay_reconciliation_lease(p_lease_key uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_lease_key is null then raise exception 'INVALID_RECONCILIATION_LEASE'; end if;
  update public.sepay_reconciliation_state
  set lease_key = p_lease_key,
    lease_until = now() + interval '5 minutes',
    updated_at = now()
  where id
    and (lease_until is null or lease_until <= now() or lease_key = p_lease_key);
  return found;
end;
$$;

create function public.complete_sepay_reconciliation(
  p_lease_key uuid,
  p_cursor_at timestamptz,
  p_cursor_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_lease_key is null or p_cursor_at is null then raise exception 'INVALID_RECONCILIATION_CURSOR'; end if;
  update public.sepay_reconciliation_state
  set cursor_at = p_cursor_at,
    cursor_key = nullif(trim(p_cursor_key), ''),
    lease_key = null,
    lease_until = null,
    updated_at = now()
  where id and lease_key = p_lease_key;
  if not found then raise exception 'RECONCILIATION_LEASE_NOT_OWNED'; end if;
end;
$$;

create function public.release_sepay_reconciliation_lease(p_lease_key uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_lease_key is null then raise exception 'INVALID_RECONCILIATION_LEASE'; end if;
  update public.sepay_reconciliation_state
  set lease_key = null, lease_until = null, updated_at = now()
  where id and lease_key = p_lease_key;
end;
$$;

revoke all on function public.process_sepay_reconciliation(text, text, timestamptz, text, text, text, integer, text, text, jsonb) from public;
grant execute on function public.process_sepay_reconciliation(text, text, timestamptz, text, text, text, integer, text, text, jsonb) to service_role;
revoke all on function public.acquire_sepay_reconciliation_lease(uuid) from public;
grant execute on function public.acquire_sepay_reconciliation_lease(uuid) to service_role;
revoke all on function public.complete_sepay_reconciliation(uuid, timestamptz, text) from public;
grant execute on function public.complete_sepay_reconciliation(uuid, timestamptz, text) to service_role;
revoke all on function public.release_sepay_reconciliation_lease(uuid) from public;
grant execute on function public.release_sepay_reconciliation_lease(uuid) to service_role;
