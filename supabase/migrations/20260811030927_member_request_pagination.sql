create index if not exists booking_requests_user_created_idx
on public.booking_requests (user_id, created_at desc, id desc);

create index if not exists customer_requests_user_created_idx
on public.customer_requests (user_id, created_at desc, id desc);

create function public.get_member_requests(
  p_user_id uuid,
  p_page integer,
  p_page_size integer
)
returns table (
  id uuid,
  reference_number bigint,
  kind text,
  request_type text,
  reservation_at timestamptz,
  subject_reference text,
  status text,
  notification_status text,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_user_id is null
    or (select auth.uid()) is null
    or (p_user_id <> (select auth.uid())
      and (select public.current_user_role()) is distinct from 'admin') then
    raise exception 'REQUESTS_FORBIDDEN';
  end if;

  if p_page is null or p_page not between 1 and 100 then
    raise exception 'INVALID_REQUEST_PAGE';
  end if;
  if p_page_size is null or p_page_size not between 1 and 50 then
    raise exception 'INVALID_REQUEST_PAGE_SIZE';
  end if;

  return query
  with request_rows as (
    select
      booking.id,
      booking.reference_number,
      'booking'::text as kind,
      'booking'::text as request_type,
      booking.reservation_at,
      null::text as subject_reference,
      booking.status,
      booking.notification_status,
      booking.created_at
    from public.booking_requests as booking
    where booking.user_id = p_user_id
    union all
    select
      customer.id,
      customer.reference_number,
      'customer'::text as kind,
      customer.request_type,
      null::timestamptz as reservation_at,
      customer.subject_reference,
      customer.status,
      customer.notification_status,
      customer.created_at
    from public.customer_requests as customer
    where customer.user_id = p_user_id
  )
  select
    rows.id,
    rows.reference_number,
    rows.kind,
    rows.request_type,
    rows.reservation_at,
    rows.subject_reference,
    rows.status,
    rows.notification_status,
    rows.created_at,
    count(*) over () as total_count
  from request_rows as rows
  order by rows.created_at desc, rows.id desc
  offset ((p_page - 1) * p_page_size)
  limit p_page_size;
end;
$$;

create function public.get_member_request_count(p_user_id uuid)
returns bigint
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_user_id is null
    or (select auth.uid()) is null
    or (p_user_id <> (select auth.uid())
      and (select public.current_user_role()) is distinct from 'admin') then
    raise exception 'REQUESTS_FORBIDDEN';
  end if;

  return (
    select count(*)
    from (
      select booking.id
      from public.booking_requests as booking
      where booking.user_id = p_user_id
      union all
      select customer.id
      from public.customer_requests as customer
      where customer.user_id = p_user_id
    ) as request_rows
  );
end;
$$;

revoke all on function public.get_member_requests(uuid, integer, integer) from public;
grant execute on function public.get_member_requests(uuid, integer, integer) to authenticated;

revoke all on function public.get_member_request_count(uuid) from public;
grant execute on function public.get_member_request_count(uuid) to authenticated;
