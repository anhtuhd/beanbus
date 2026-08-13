drop function if exists public.get_admin_notification_failures(integer);

create function public.get_admin_notification_failures(
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  notification_id uuid,
  recipient_email text,
  attempt_count integer,
  last_error_code text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or (select public.current_user_role()) is distinct from 'admin' then
    raise exception 'ADMIN_REQUIRED';
  end if;
  return query
  select outbox.id, outbox.notification_id, outbox.recipient_email,
    outbox.attempt_count, outbox.last_error_code, outbox.updated_at
  from public.email_outbox as outbox
  where outbox.status = 'failed'
  order by outbox.updated_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create function public.get_admin_notification_failures(p_limit integer default 50)
returns table (
  id uuid,
  notification_id uuid,
  recipient_email text,
  attempt_count integer,
  last_error_code text,
  updated_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select * from public.get_admin_notification_failures(p_limit, 0);
$$;

revoke all on function public.get_admin_notification_failures(integer, integer) from public, anon, authenticated;
grant execute on function public.get_admin_notification_failures(integer, integer) to authenticated;
revoke all on function public.get_admin_notification_failures(integer) from public, anon, authenticated;
grant execute on function public.get_admin_notification_failures(integer) to authenticated;
