comment on column public.vouchers.usage_count is
  'Active reservations plus consumed orders; released reservations decrement this count.';

create table public.voucher_reservations (
  order_id uuid primary key references public.orders (id) on delete restrict,
  voucher_code text not null references public.vouchers (code) on delete restrict,
  status text not null default 'reserved' check (status in ('reserved', 'consumed', 'released')),
  reserved_at timestamptz not null default now(),
  consumed_at timestamptz,
  released_at timestamptz,
  updated_at timestamptz not null default now(),
  check ((status = 'consumed') = (consumed_at is not null)),
  check ((status = 'released') = (released_at is not null)),
  check (not (consumed_at is not null and released_at is not null))
);

create index voucher_reservations_code_status_idx
on public.voucher_reservations (voucher_code, status, updated_at desc);

alter table public.voucher_reservations enable row level security;
revoke all on table public.voucher_reservations from anon, authenticated;
grant all on table public.voucher_reservations to service_role;

create or replace function public.sync_voucher_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.voucher_reservations%rowtype;
begin
  if tg_op = 'INSERT' then
    if new.voucher_code is not null then
      insert into public.voucher_reservations (order_id, voucher_code)
      values (new.id, new.voucher_code)
      on conflict (order_id) do nothing;
    end if;
    return new;
  end if;

  select * into v_reservation
  from public.voucher_reservations
  where order_id = new.id
  for update;
  if not found or v_reservation.status <> 'reserved' then return new; end if;

  if new.payment_status = 'paid'
    or (new.payment_method = 'cod' and new.status = 'completed') then
    update public.voucher_reservations
    set status = 'consumed', consumed_at = coalesce(consumed_at, now()), updated_at = now()
    where order_id = new.id and status = 'reserved';
  elsif new.status = 'cancelled' or new.payment_status in ('failed', 'refunded') then
    update public.voucher_reservations
    set status = 'released', released_at = coalesce(released_at, now()), updated_at = now()
    where order_id = new.id and status = 'reserved';

    update public.vouchers
    set usage_count = greatest(usage_count - 1, 0), updated_at = now()
    where code = v_reservation.voucher_code;
  end if;

  return new;
end;
$$;

create trigger orders_create_voucher_reservation
after insert on public.orders
for each row execute function public.sync_voucher_reservation();

create trigger orders_sync_voucher_reservation
after update of status, payment_status on public.orders
for each row execute function public.sync_voucher_reservation();

create or replace function public.sync_order_after_payment_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('expired', 'failed') and old.status is distinct from new.status then
    update public.orders
    set payment_status = 'failed'
    where id = new.order_id and payment_status = 'pending';
  elsif new.status = 'refunded' and old.status is distinct from new.status then
    update public.orders
    set payment_status = 'refunded'
    where id = new.order_id and payment_status = 'paid';
  end if;
  return new;
end;
$$;

create trigger payments_sync_order_payment_status
after update of status on public.payments
for each row execute function public.sync_order_after_payment_status();

create function public.expire_pending_sepay_payments()
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

  update public.orders
  set payment_status = 'failed', updated_at = now()
  where payment_method = 'sepay_qr'
    and payment_status = 'pending'
    and status = 'pending'
    and created_at <= now() - interval '30 minutes'
    and not exists (
      select 1 from public.payments where payments.order_id = orders.id
    );
  get diagnostics v_abandoned = row_count;
  return v_expired + v_abandoned;
end;
$$;

revoke all on function public.sync_voucher_reservation() from public;
revoke all on function public.sync_order_after_payment_status() from public;
revoke all on function public.expire_pending_sepay_payments() from public, anon, authenticated;
grant execute on function public.expire_pending_sepay_payments() to service_role;
