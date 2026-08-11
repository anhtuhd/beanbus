create or replace function public.update_loyalty_policy(
  p_enabled boolean,
  p_earn_bps integer,
  p_cod_eligible boolean
)
returns table (updated_enabled boolean, updated_earn_bps integer, updated_cod_eligible boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select public.current_user_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_enabled is null or p_earn_bps is null or p_earn_bps not between 0 and 10000 or p_cod_eligible is null then
    raise exception 'INVALID_LOYALTY_POLICY';
  end if;

  perform 1 from public.loyalty_policy where id for update;
  if not found then raise exception 'LOYALTY_POLICY_NOT_FOUND'; end if;

  update public.loyalty_policy
  set enabled = p_enabled,
    earn_bps = p_earn_bps,
    cod_eligible = p_cod_eligible,
    updated_at = now(),
    updated_by = (select auth.uid())
  where id;
  insert into public.loyalty_policy_history (enabled, earn_bps, cod_eligible, actor_user_id)
  values (p_enabled, p_earn_bps, p_cod_eligible, (select auth.uid()));
  return query select p_enabled, p_earn_bps, p_cod_eligible;
end;
$$;

create or replace function public.process_sepay_reconciliation(
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
    or p_content is null
    or char_length(trim(p_content)) not between 1 and 2000
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
begin
  if p_gateway is null or char_length(trim(p_gateway)) not between 1 and 100 then
    raise exception 'INVALID_WEBHOOK_EVENT';
  end if;

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

create or replace function public.process_stored_value_webhook(
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
  if p_gateway is null or char_length(trim(p_gateway)) not between 1 and 100 then
    raise exception 'INVALID_WEBHOOK_EVENT';
  end if;

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

revoke all on function public.update_loyalty_policy(boolean, integer, boolean) from public;
grant execute on function public.update_loyalty_policy(boolean, integer, boolean) to authenticated;
revoke all on function public.process_sepay_reconciliation(text, text, timestamptz, text, text, text, integer, text, text, jsonb) from public;
grant execute on function public.process_sepay_reconciliation(text, text, timestamptz, text, text, text, integer, text, text, jsonb) to service_role;
revoke all on function public.process_sepay_webhook(bigint, text, timestamptz, text, text, text, integer, text, jsonb) from public;
grant execute on function public.process_sepay_webhook(bigint, text, timestamptz, text, text, text, integer, text, jsonb) to service_role;
revoke all on function public.process_stored_value_webhook(bigint, text, timestamptz, text, text, text, integer, text, jsonb) from public;
grant execute on function public.process_stored_value_webhook(bigint, text, timestamptz, text, text, text, integer, text, jsonb) to service_role;
