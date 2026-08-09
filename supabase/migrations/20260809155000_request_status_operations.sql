create table public.booking_request_status_history (
  id bigint generated always as identity primary key,
  booking_request_id uuid not null references public.booking_requests (id) on delete cascade,
  from_status text not null,
  to_status text not null,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.customer_request_status_history (
  id bigint generated always as identity primary key,
  customer_request_id uuid not null references public.customer_requests (id) on delete cascade,
  from_status text not null,
  to_status text not null,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index booking_request_status_history_request_idx
on public.booking_request_status_history (booking_request_id, created_at desc);
create index customer_request_status_history_request_idx
on public.customer_request_status_history (customer_request_id, created_at desc);

alter table public.booking_request_status_history enable row level security;
alter table public.customer_request_status_history enable row level security;

revoke all on table public.booking_request_status_history from anon, authenticated;
revoke all on table public.customer_request_status_history from anon, authenticated;
grant select on table public.booking_request_status_history to authenticated;
grant select on table public.customer_request_status_history to authenticated;
grant all on table public.booking_request_status_history to service_role;
grant all on table public.customer_request_status_history to service_role;

create policy "Admins read booking request history"
on public.booking_request_status_history for select to authenticated
using ((select public.current_user_role()) = 'admin');

create policy "Admins read customer request history"
on public.customer_request_status_history for select to authenticated
using ((select public.current_user_role()) = 'admin');

revoke update (status, notification_status, updated_at) on table public.booking_requests from authenticated;
revoke update (status, notification_status, updated_at) on table public.customer_requests from authenticated;

create function public.update_booking_request_status(
  p_request_id uuid,
  p_status text
)
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
  v_transition text;
begin
  if (select public.current_user_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_request_id is null or p_status is null then raise exception 'INVALID_BOOKING_STATUS'; end if;

  select * into v_booking
  from public.booking_requests
  where id = p_request_id
  for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;

  if v_booking.status = p_status then
    return query select v_booking.id, v_booking.status;
    return;
  end if;

  v_transition := v_booking.status || ':' || p_status;
  if v_transition not in (
    'pending:confirmed',
    'pending:rejected',
    'pending:cancelled',
    'confirmed:completed',
    'confirmed:cancelled'
  ) then raise exception 'INVALID_BOOKING_TRANSITION'; end if;

  update public.booking_requests set status = p_status where id = v_booking.id;
  insert into public.booking_request_status_history (
    booking_request_id, from_status, to_status, actor_user_id
  ) values (
    v_booking.id, v_booking.status, p_status, (select auth.uid())
  );

  return query select v_booking.id, p_status;
end;
$$;

create function public.update_customer_request_status(
  p_request_id uuid,
  p_status text
)
returns table (
  customer_request_id uuid,
  customer_request_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.customer_requests%rowtype;
  v_transition text;
begin
  if (select public.current_user_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_request_id is null or p_status is null then raise exception 'INVALID_REQUEST_STATUS'; end if;

  select * into v_request
  from public.customer_requests
  where id = p_request_id
  for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;

  if v_request.status = p_status then
    return query select v_request.id, v_request.status;
    return;
  end if;

  v_transition := v_request.status || ':' || p_status;
  if v_transition not in (
    'pending:in_progress',
    'pending:rejected',
    'in_progress:resolved',
    'in_progress:rejected'
  ) then raise exception 'INVALID_REQUEST_TRANSITION'; end if;

  update public.customer_requests set status = p_status where id = v_request.id;
  insert into public.customer_request_status_history (
    customer_request_id, from_status, to_status, actor_user_id
  ) values (
    v_request.id, v_request.status, p_status, (select auth.uid())
  );

  return query select v_request.id, p_status;
end;
$$;

revoke all on function public.update_booking_request_status(uuid, text) from public;
revoke all on function public.update_customer_request_status(uuid, text) from public;
grant execute on function public.update_booking_request_status(uuid, text) to authenticated;
grant execute on function public.update_customer_request_status(uuid, text) to authenticated;
