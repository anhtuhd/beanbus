begin;

create extension if not exists pgtap with schema extensions;
select plan(5);

select has_function(
  'public', 'get_member_loyalty_summary', array['uuid'],
  'loyalty summary function exists after lint fix'
);
select ok(
  position('select sum(ledger.points)' in pg_get_functiondef('public.get_member_loyalty_summary(uuid)'::regprocedure)) > 0,
  'loyalty summary uses scalar aggregates without an invalid GROUP BY'
);
select ok(
  position('extensions.gen_random_bytes' in pg_get_functiondef('public.admin_upsert_event(text,text,text,text,text,text,text,text,timestamptz,timestamptz,text,text,text,integer,boolean,boolean,integer)'::regprocedure)) > 0,
  'event editor uses the installed crypto schema'
);
select ok(
  position('extensions.gen_random_bytes' in pg_get_functiondef('public.admin_upsert_blog_post(text,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean,integer)'::regprocedure)) > 0,
  'blog editor uses the installed crypto schema'
);
select ok(
  to_regprocedure('extensions.gen_random_bytes(integer)') is not null,
  'crypto helper is available in the extensions schema'
);

select * from finish();
rollback;
