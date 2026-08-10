create function public.enforce_rsvp_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max_seats integer;
  v_starts_at timestamptz;
begin
  if new.request_type <> 'rsvp' then return new; end if;

  perform pg_advisory_xact_lock(hashtextextended('event:' || new.subject_reference, 0));
  select max_seats, starts_at
  into v_max_seats, v_starts_at
  from public.events
  where id = new.subject_reference
    and is_published
    and published_at is not null
  for update;

  if not found then raise exception 'INVALID_EVENT'; end if;
  if v_starts_at <= now() then raise exception 'EVENT_CLOSED'; end if;

  if v_max_seats is not null and (
    select count(*) from public.customer_requests
    where request_type = 'rsvp'
      and subject_reference = new.subject_reference
      and status in ('pending', 'in_progress', 'resolved')
  ) >= v_max_seats then
    raise exception 'EVENT_FULL';
  end if;

  return new;
end;
$$;

create trigger customer_requests_enforce_rsvp_capacity
before insert on public.customer_requests
for each row execute function public.enforce_rsvp_capacity();

revoke all on function public.enforce_rsvp_capacity() from public;
