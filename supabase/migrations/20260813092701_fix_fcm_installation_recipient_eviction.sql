alter table public.fcm_installation_recipients
alter column created_at set default clock_timestamp();

create or replace function private.trim_fcm_installation_recipients(
  p_user_id uuid,
  p_guest_session_id uuid,
  p_limit integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eviction record;
begin
  if num_nonnulls(p_user_id, p_guest_session_id) <> 1 or p_limit < 1 then
    raise exception 'INVALID_FCM_RECIPIENT_SCOPE';
  end if;

  for v_eviction in
    select recipient.id, recipient.installation_id
    from public.fcm_installation_recipients as recipient
    where (p_user_id is not null and recipient.user_id = p_user_id)
       or (p_guest_session_id is not null and recipient.guest_session_id = p_guest_session_id)
    order by recipient.created_at desc, recipient.id desc
    offset p_limit
  loop
    delete from public.fcm_installation_recipients
    where id = v_eviction.id;

    if not exists (
      select 1
      from public.fcm_installation_recipients as remaining
      where remaining.installation_id = v_eviction.installation_id
    ) then
      update public.fcm_installations
      set active = false, updated_at = now()
      where id = v_eviction.installation_id;

      update public.push_outbox
      set status = 'cancelled',
          last_error_code = 'INSTALLATION_EVICTED',
          locked_until = null,
          locked_by = null,
          updated_at = now()
      where installation_id = v_eviction.installation_id
        and status in ('pending', 'processing');
    end if;
  end loop;
end;
$$;

revoke all on function private.trim_fcm_installation_recipients(uuid, uuid, integer)
from public, anon, authenticated, service_role;
