create or replace function public.process_sepay_webhook(
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
  v_existing_status text;
  v_existing_payment_id uuid;
  v_existing_reason text;
begin
  if p_gateway is null or char_length(trim(p_gateway)) not between 1 and 100 then
    raise exception 'INVALID_WEBHOOK_EVENT';
  end if;

  insert into public.sepay_webhook_events (provider_transaction_id, payload)
  values (p_provider_transaction_id, p_payload)
  on conflict (provider_transaction_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select events.status, events.payment_id, events.reason, payments.order_id
    into v_existing_status, v_existing_payment_id, v_existing_reason, v_existing_order_id
    from public.sepay_webhook_events as events
    left join public.payments as payments on payments.id = events.payment_id
    where events.provider_transaction_id = p_provider_transaction_id
    for update of events;

    if v_existing_status = 'rejected'
      and v_existing_payment_id is null
      and v_existing_reason = 'PAYMENT_NOT_FOUND' then
      update public.sepay_webhook_events
      set payload = p_payload, status = 'received', reason = null, processed_at = null
      where provider_transaction_id = p_provider_transaction_id;
      v_inserted := 1;
    else
      return query select 'duplicate'::text, v_existing_order_id;
      return;
    end if;
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
