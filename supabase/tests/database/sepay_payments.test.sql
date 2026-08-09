begin;

create extension if not exists pgtap with schema extensions;
select plan(19);

select has_table('public', 'payments', 'payments table exists');
select has_table('public', 'sepay_webhook_events', 'webhook event ledger exists');
select has_function('public', 'create_sepay_payment', array['uuid', 'uuid', 'text', 'text'], 'payment creation function exists');
select has_function(
  'public', 'process_sepay_webhook',
  array['bigint', 'text', 'timestamp with time zone', 'text', 'text', 'text', 'integer', 'text', 'jsonb'],
  'webhook processing function exists'
);

set local role anon;
create temporary table sepay_order as
select * from public.create_server_priced_order(
  '88888888-8888-4888-8888-888888888888', 'Khách Sepay', '+84912345678',
  'pickup', now() + interval '1 hour', null, null, 'sepay_qr', null,
  '[{"productId":"cd-1","quantity":1,"optionIds":[]}]'::jsonb
);
create temporary table sepay_receipt as
select * from public.issue_order_receipt('88888888-8888-4888-8888-888888888888');

reset role;
create temporary table sepay_payment as
select * from public.create_sepay_payment(
  (select order_id from sepay_receipt), (select receipt_token from sepay_receipt), 'MB', '0937936688'
);

select matches((select payment_code from sepay_payment), '^BB[0-9]+$', 'payment uses readable order code');
select is((select amount_vnd from sepay_payment), 35000, 'payment amount matches canonical order total');
select is((select count(*)::integer from public.create_sepay_payment(
  (select order_id from sepay_receipt), (select receipt_token from sepay_receipt), 'MB', '0937936688'
)), 1, 'payment creation retry returns the existing payment');
select is((select count(*)::integer from public.payments), 1, 'payment creation remains idempotent');

create temporary table processed_event as
select * from public.process_sepay_webhook(
  92704, 'MBBank', now(), '0937936688', (select payment_code from sepay_payment), 'in', 35000, 'FT26080912345',
  '{"id":92704,"transferType":"in","transferAmount":35000}'::jsonb
);
select is((select outcome from processed_event), 'processed', 'matching inbound transfer is processed');
select is((select payment_status::text from public.orders where id = (select order_id from sepay_receipt)), 'paid', 'order is marked paid');

create temporary table duplicate_event as
select * from public.process_sepay_webhook(
  92704, 'MBBank', now(), '0937936688', (select payment_code from sepay_payment), 'in', 35000, 'FT26080912345',
  '{"id":92704,"transferType":"in","transferAmount":35000}'::jsonb
);
select is((select outcome from duplicate_event), 'duplicate', 'provider transaction replay is deduplicated');
select is((select count(*)::integer from public.sepay_webhook_events), 1, 'duplicate delivery creates one event row');
select is((select count(*)::integer from public.payments where status = 'paid'), 1, 'duplicate delivery creates one paid transition');

set local role anon;
create temporary table mismatch_order as
select * from public.create_server_priced_order(
  '99999999-9999-4999-8999-999999999999', 'Khách Mismatch', '+84912345679',
  'pickup', now() + interval '1 hour', null, null, 'sepay_qr', null,
  '[{"productId":"cd-1","quantity":1,"optionIds":[]}]'::jsonb
);
create temporary table mismatch_receipt as
select * from public.issue_order_receipt('99999999-9999-4999-8999-999999999999');

reset role;
create temporary table mismatch_payment as
select * from public.create_sepay_payment(
  (select order_id from mismatch_receipt), (select receipt_token from mismatch_receipt), 'MB', '0937936688'
);
create temporary table mismatch_event as
select * from public.process_sepay_webhook(
  92705, 'MBBank', now(), '0937936688', (select payment_code from mismatch_payment), 'in', 1, 'FT26080912346',
  '{"id":92705,"transferType":"in","transferAmount":1}'::jsonb
);
select is((select outcome from mismatch_event), 'rejected', 'amount mismatch is rejected');
select is((select status from public.payments where id = (select payment_id from mismatch_payment)), 'pending', 'mismatched payment stays pending');
select is((select reason from public.sepay_webhook_events where provider_transaction_id = 92705), 'AMOUNT_MISMATCH', 'amount mismatch is auditable');

select is(
  (select outcome from public.process_sepay_webhook(
    92706, 'MBBank', now(), '0937936688', (select payment_code from mismatch_payment), 'out', 35000, 'FT26080912347',
    '{"id":92706,"transferType":"out","transferAmount":35000}'::jsonb
  )),
  'rejected',
  'outbound transfer is rejected'
);

update public.payments set expires_at = now() - interval '1 minute'
where id = (select payment_id from mismatch_payment);
select is(
  (select outcome from public.process_sepay_webhook(
    92707, 'MBBank', now(), '0937936688', (select payment_code from mismatch_payment), 'in', 35000, 'FT26080912348',
    '{"id":92707,"transferType":"in","transferAmount":35000}'::jsonb
  )),
  'rejected',
  'transfer after expiry is rejected'
);
select is((select status from public.payments where id = (select payment_id from mismatch_payment)), 'expired', 'late payment moves to expired state');

select * from finish();
rollback;
