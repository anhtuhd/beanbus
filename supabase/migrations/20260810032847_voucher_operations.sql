create table public.voucher_change_history (
  id bigint generated always as identity primary key,
  voucher_code text not null,
  operation text not null check (operation in ('created', 'updated')),
  before_data jsonb,
  after_data jsonb not null,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index voucher_change_history_code_idx on public.voucher_change_history (voucher_code, created_at desc);
alter table public.voucher_change_history enable row level security;
revoke all on table public.voucher_change_history from anon, authenticated;
grant select on table public.voucher_change_history to authenticated;
grant all on table public.voucher_change_history to service_role;

create policy "Admins read voucher change history"
on public.voucher_change_history for select to authenticated
using ((select public.current_user_role()) = 'admin');

revoke insert, update, delete on table public.vouchers from authenticated;

create function public.admin_upsert_voucher(
  p_code text,
  p_discount_type public.discount_type,
  p_discount_value integer,
  p_minimum_subtotal_vnd integer,
  p_maximum_discount_vnd integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_usage_limit integer,
  p_is_active boolean
)
returns table (updated_voucher_code text, operation text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_voucher public.vouchers%rowtype;
  v_code text := upper(trim(p_code));
  v_before jsonb;
  v_after jsonb;
  v_operation text;
begin
  if (select public.current_user_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if v_code is null or v_code !~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'
    or p_discount_type is null or p_discount_value is null or p_discount_value <= 0
    or p_minimum_subtotal_vnd is null or p_minimum_subtotal_vnd < 0
    or (p_maximum_discount_vnd is not null and p_maximum_discount_vnd <= 0)
    or (p_usage_limit is not null and p_usage_limit <= 0)
    or (p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at)
    or p_is_active is null then raise exception 'INVALID_VOUCHER'; end if;
  if p_discount_type = 'percent' and p_discount_value > 100 then raise exception 'INVALID_VOUCHER_PERCENT'; end if;
  if p_discount_type = 'fixed' and p_maximum_discount_vnd is not null then raise exception 'INVALID_VOUCHER_CAP'; end if;

  select * into v_voucher from public.vouchers where code = v_code for update;
  if found then v_before := to_jsonb(v_voucher); end if;

  insert into public.vouchers (
    code, discount_type, discount_value, minimum_subtotal_vnd, maximum_discount_vnd,
    starts_at, ends_at, usage_limit, is_active
  ) values (
    v_code, p_discount_type, p_discount_value, p_minimum_subtotal_vnd, p_maximum_discount_vnd,
    p_starts_at, p_ends_at, p_usage_limit, p_is_active
  )
  on conflict (code) do update set
    discount_type = excluded.discount_type,
    discount_value = excluded.discount_value,
    minimum_subtotal_vnd = excluded.minimum_subtotal_vnd,
    maximum_discount_vnd = excluded.maximum_discount_vnd,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    usage_limit = excluded.usage_limit,
    is_active = excluded.is_active;

  v_operation := case when v_before is null then 'created' else 'updated' end;
  select to_jsonb(vouchers) into v_after from public.vouchers where code = v_code;
  insert into public.voucher_change_history (voucher_code, operation, before_data, after_data, actor_user_id)
  values (v_code, v_operation, v_before, v_after, (select auth.uid()));
  return query select v_code, v_operation;
end;
$$;

revoke all on function public.admin_upsert_voucher(text, public.discount_type, integer, integer, integer, timestamptz, timestamptz, integer, boolean) from public;
grant execute on function public.admin_upsert_voucher(text, public.discount_type, integer, integer, integer, timestamptz, timestamptz, integer, boolean) to authenticated;
