create function public.cancel_owned_booking_request(p_request_id uuid)
returns table (
  booking_id uuid,
  booking_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.booking_requests%rowtype;
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_request_id is null then raise exception 'INVALID_BOOKING_ID'; end if;

  select * into v_booking
  from public.booking_requests
  where id = p_request_id
    and user_id = v_user_id
  for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;

  if v_booking.status = 'cancelled' then
    return query select v_booking.id, v_booking.status;
    return;
  end if;
  if v_booking.status not in ('pending', 'confirmed') then
    raise exception 'BOOKING_CANNOT_CANCEL';
  end if;

  update public.booking_requests
  set status = 'cancelled'
  where id = v_booking.id;

  insert into public.booking_request_status_history (
    booking_request_id, from_status, to_status, actor_user_id
  ) values (
    v_booking.id, v_booking.status, 'cancelled', v_user_id
  );

  return query select v_booking.id, 'cancelled'::text;
end;
$$;

revoke all on function public.cancel_owned_booking_request(uuid) from public;
grant execute on function public.cancel_owned_booking_request(uuid) to authenticated;
