create or replace function public.get_current_profile()
returns table (
  id uuid,
  member_number bigint,
  full_name text,
  phone text,
  email text,
  birthday date,
  avatar_url text,
  role public.app_role,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    profiles.id,
    profiles.member_number,
    profiles.full_name,
    profiles.phone,
    profiles.email,
    profiles.birthday,
    profiles.avatar_url,
    profiles.role,
    profiles.created_at,
    profiles.updated_at
  from public.profiles
  where profiles.id = (select auth.uid())
$$;

revoke all on function public.get_current_profile() from public;
grant execute on function public.get_current_profile() to authenticated;

create index if not exists orders_created_at_idx
on public.orders (created_at desc);

create index if not exists orders_status_created_idx
on public.orders (status, created_at desc);

create index if not exists booking_requests_created_at_idx
on public.booking_requests (created_at desc);

create index if not exists booking_requests_status_created_idx
on public.booking_requests (status, created_at desc);

create index if not exists customer_requests_created_at_idx
on public.customer_requests (created_at desc);

create index if not exists vouchers_created_at_idx
on public.vouchers (created_at desc);

create or replace view public.admin_request_feed
with (security_invoker = true)
as
select
  'booking'::text as kind,
  booking_requests.id,
  booking_requests.reference_number,
  'booking'::text as request_type,
  booking_requests.customer_name as display_name,
  booking_requests.customer_phone as display_phone,
  null::text as contact_email,
  booking_requests.reservation_at,
  booking_requests.guest_count,
  booking_requests.seating_area,
  booking_requests.note,
  null::text as subject_reference,
  null::text as organization,
  null::text as volume_range,
  null::text as message,
  booking_requests.status::text as status,
  booking_requests.created_at
from public.booking_requests
where (select public.current_user_role()) = 'admin'
union all
select
  'customer'::text as kind,
  customer_requests.id,
  customer_requests.reference_number,
  customer_requests.request_type,
  customer_requests.contact_name as display_name,
  customer_requests.contact_phone as display_phone,
  customer_requests.contact_email,
  null::timestamptz as reservation_at,
  null::integer as guest_count,
  null::text as seating_area,
  null::text as note,
  customer_requests.subject_reference,
  customer_requests.organization,
  customer_requests.volume_range::text,
  customer_requests.message,
  customer_requests.status::text as status,
  customer_requests.created_at
from public.customer_requests
where (select public.current_user_role()) = 'admin';

revoke all on public.admin_request_feed from public, anon, authenticated;
grant select on public.admin_request_feed to authenticated;
