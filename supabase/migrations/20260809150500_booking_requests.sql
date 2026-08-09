create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  reference_number bigint generated always as identity unique,
  idempotency_key uuid not null unique,
  user_id uuid references auth.users (id) on delete set null,
  customer_name text not null check (char_length(customer_name) between 2 and 100),
  customer_phone text not null check (customer_phone ~ '^\+84[35789][0-9]{8}$'),
  reservation_at timestamptz not null,
  guest_count integer not null check (guest_count between 1 and 20),
  seating_area text not null check (seating_area in ('indoor', 'balcony', 'roastery_bar')),
  note text check (note is null or char_length(note) <= 500),
  consent_to_contact boolean not null check (consent_to_contact),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'rejected')),
  notification_status text not null default 'not_configured' check (notification_status in ('not_configured', 'pending', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index booking_requests_phone_created_idx on public.booking_requests (customer_phone, created_at desc);
create index booking_requests_reservation_idx on public.booking_requests (reservation_at, status);

alter table public.booking_requests enable row level security;
revoke all on table public.booking_requests from anon, authenticated;
grant select on table public.booking_requests to authenticated;
grant update (status, notification_status, updated_at) on table public.booking_requests to authenticated;
grant all on table public.booking_requests to service_role;

create policy "Members read their booking requests"
on public.booking_requests for select to authenticated
using ((select auth.uid()) = user_id or (select public.current_user_role()) = 'admin');

create policy "Admins update booking requests"
on public.booking_requests for update to authenticated
using ((select public.current_user_role()) = 'admin')
with check ((select public.current_user_role()) = 'admin');

create trigger booking_requests_set_updated_at before update on public.booking_requests
for each row execute function public.set_updated_at();

create function public.create_booking_request(
  p_idempotency_key uuid,
  p_customer_name text,
  p_customer_phone text,
  p_reservation_at timestamptz,
  p_guest_count integer,
  p_seating_area text,
  p_note text,
  p_consent_to_contact boolean
)
returns table (
  booking_id uuid,
  booking_number bigint,
  booking_status text,
  reservation_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.booking_requests%rowtype;
begin
  if p_idempotency_key is null then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

  select * into v_booking from public.booking_requests where idempotency_key = p_idempotency_key;
  if found then
    if v_booking.user_id is distinct from (select auth.uid()) then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return query select v_booking.id, v_booking.reference_number, v_booking.status, v_booking.reservation_at;
    return;
  end if;

  if p_customer_name is null
    or char_length(trim(p_customer_name)) not between 2 and 100
    or p_customer_phone is null
    or p_customer_phone !~ '^\+84[35789][0-9]{8}$' then
    raise exception 'INVALID_CUSTOMER';
  end if;
  if p_reservation_at is null
    or p_reservation_at < now() + interval '30 minutes'
    or p_reservation_at > now() + interval '90 days' then
    raise exception 'INVALID_RESERVATION_TIME';
  end if;
  if p_guest_count is null or p_guest_count not between 1 and 20 then raise exception 'INVALID_GUEST_COUNT'; end if;
  if p_seating_area is null or p_seating_area not in ('indoor', 'balcony', 'roastery_bar') then raise exception 'INVALID_SEATING_AREA'; end if;
  if char_length(coalesce(p_note, '')) > 500 then raise exception 'INVALID_NOTE'; end if;
  if p_consent_to_contact is not true then raise exception 'CONSENT_REQUIRED'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_customer_phone, 0));
  if (select count(*) from public.booking_requests
      where customer_phone = p_customer_phone and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'RATE_LIMITED';
  end if;

  insert into public.booking_requests (
    idempotency_key, user_id, customer_name, customer_phone, reservation_at,
    guest_count, seating_area, note, consent_to_contact
  ) values (
    p_idempotency_key, (select auth.uid()), trim(p_customer_name), p_customer_phone,
    p_reservation_at, p_guest_count, p_seating_area, nullif(trim(p_note), ''), true
  ) returning * into v_booking;

  return query select v_booking.id, v_booking.reference_number, v_booking.status, v_booking.reservation_at;
end;
$$;

revoke all on function public.create_booking_request(uuid, text, text, timestamptz, integer, text, text, boolean) from public;
grant execute on function public.create_booking_request(uuid, text, text, timestamptz, integer, text, text, boolean) to anon, authenticated;
