alter table public.customer_requests
  drop constraint if exists customer_requests_status_check;

alter table public.customer_requests
  add constraint customer_requests_status_check
  check (status in ('pending', 'in_progress', 'resolved', 'rejected', 'cancelled'));

create function public.cancel_owned_customer_request(p_request_id uuid)
returns table (
  request_id uuid,
  request_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.customer_requests%rowtype;
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_request_id is null then raise exception 'INVALID_REQUEST_ID'; end if;

  select * into v_request
  from public.customer_requests
  where id = p_request_id
    and user_id = v_user_id
  for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;

  if v_request.status = 'cancelled' then
    return query select v_request.id, v_request.status;
    return;
  end if;
  if v_request.status not in ('pending', 'in_progress') then
    raise exception 'REQUEST_CANNOT_CANCEL';
  end if;

  update public.customer_requests
  set status = 'cancelled'
  where id = v_request.id;

  insert into public.customer_request_status_history (
    customer_request_id, from_status, to_status, actor_user_id
  ) values (
    v_request.id, v_request.status, 'cancelled', v_user_id
  );

  return query select v_request.id, 'cancelled'::text;
end;
$$;

revoke all on function public.cancel_owned_customer_request(uuid) from public;
grant execute on function public.cancel_owned_customer_request(uuid) to authenticated;
