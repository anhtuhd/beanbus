begin;

create extension if not exists pgtap with schema extensions;
select plan(4);

select has_function(
  'public', 'update_loyalty_policy', array['boolean', 'integer', 'boolean'],
  'loyalty policy function keeps its public signature'
);
select has_function(
  'public', 'process_sepay_reconciliation',
  array['text', 'text', 'timestamp with time zone', 'text', 'text', 'text', 'integer', 'text', 'text', 'jsonb'],
  'reconciliation function keeps its public signature'
);
select has_function(
  'public', 'process_sepay_webhook',
  array['bigint', 'text', 'timestamp with time zone', 'text', 'text', 'text', 'integer', 'text', 'jsonb'],
  'SePay webhook function keeps its public signature'
);
select has_function(
  'public', 'process_stored_value_webhook',
  array['bigint', 'text', 'timestamp with time zone', 'text', 'text', 'text', 'integer', 'text', 'jsonb'],
  'stored-value webhook function keeps its public signature'
);

select * from finish();
rollback;
