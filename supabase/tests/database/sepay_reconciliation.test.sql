begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

select has_table('public', 'sepay_reconciliation_events', 'reconciliation event ledger exists');
select has_table('public', 'sepay_reconciliation_state', 'reconciliation state table exists');
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'provider_transaction_key'
  ),
  'payments stores text provider transaction keys'
);
select has_function(
  'public', 'process_sepay_reconciliation',
  array['text', 'text', 'timestamp with time zone', 'text', 'text', 'text', 'integer', 'text', 'text', 'jsonb'],
  'reconciliation processing function exists'
);
select has_function(
  'public', 'acquire_sepay_reconciliation_lease',
  array['uuid'],
  'reconciliation lease function exists'
);

set local role anon;
create temporary table reconciliation_order as
select * from public.create_server_priced_order(
  '12121212-1212-4121-8121-121212121212', 'Khách Đối Soát', '+84912345678',
  'pickup', now() + interval '1 hour', null, null, 'sepay_qr', null,
  '[{"productId":"cd-1","quantity":1,"optionIds":[]}]'::jsonb
);
create temporary table reconciliation_receipt as
select * from public.issue_order_receipt('12121212-1212-4121-8121-121212121212');
reset role;

create temporary table reconciliation_payment as
select * from public.create_sepay_payment(
  (select order_id from reconciliation_receipt),
  (select receipt_token from reconciliation_receipt),
  'MB', '0937936688'
);

select is(
  (select outcome from public.process_sepay_reconciliation(
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'MBBank', now(), '0937936688',
    (select payment_code from reconciliation_payment), 'in', 1, 'FT-MISMATCH', 'DH-260811ABC123',
    '{"id":"a1b2c3d4-e5f6-7890-abcd-ef1234567890"}'::jsonb
  )),
  'rejected',
  'reconciliation rejects an amount mismatch'
);
select is(
  (select reason from public.sepay_reconciliation_events where provider_transaction_key = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  'AMOUNT_MISMATCH',
  'reconciliation amount mismatch is auditable'
);
select is(
  (select status from public.payments where id = (select payment_id from reconciliation_payment)),
  'pending',
  'amount mismatch leaves the payment pending'
);

create temporary table reconciled_event as
select * from public.process_sepay_reconciliation(
  'b1b2c3d4-e5f6-7890-abcd-ef1234567890', 'MBBank', now(), '0937936688',
  (select payment_code from reconciliation_payment), 'in', 35000, 'FT-VALID', 'DH-260811ABC123',
  '{"id":"b1b2c3d4-e5f6-7890-abcd-ef1234567890"}'::jsonb
);
select is((select outcome from reconciled_event), 'processed', 'matching API transaction is processed');
select is(
  (select status from public.payments where id = (select payment_id from reconciliation_payment)),
  'paid',
  'reconciliation marks the payment paid'
);
select is(
  (select provider_transaction_key from public.payments where id = (select payment_id from reconciliation_payment)),
  'b1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'reconciliation stores the UUID provider key'
);
select is(
  (select outcome from public.process_sepay_reconciliation(
    'b1b2c3d4-e5f6-7890-abcd-ef1234567890', 'MBBank', now(), '0937936688',
    (select payment_code from reconciliation_payment), 'in', 35000, 'FT-VALID', 'DH-260811ABC123',
    '{"id":"b1b2c3d4-e5f6-7890-abcd-ef1234567890"}'::jsonb
  )),
  'duplicate',
  'reconciliation replay is deduplicated'
);
select is((select count(*)::integer from public.sepay_reconciliation_events), 2, 'reconciliation keeps one row per provider key');

select is(
  public.acquire_sepay_reconciliation_lease('c1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  true,
  'first reconciliation worker acquires the lease'
);
select is(
  public.acquire_sepay_reconciliation_lease('d1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  false,
  'a second reconciliation worker cannot steal an active lease'
);
select public.complete_sepay_reconciliation(
  'c1b2c3d4-e5f6-7890-abcd-ef1234567890', now(), 'b1b2c3d4-e5f6-7890-abcd-ef1234567890'
);
select ok((select cursor_at is not null from public.sepay_reconciliation_state), 'successful run advances the checkpoint');
select is(
  public.acquire_sepay_reconciliation_lease('d1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  true,
  'completed lease can be acquired by the next worker'
);
select public.release_sepay_reconciliation_lease('d1b2c3d4-e5f6-7890-abcd-ef1234567890');
select ok((select lease_key is null and lease_until is null from public.sepay_reconciliation_state), 'failed or cancelled run can release its lease');

select * from finish();
rollback;
