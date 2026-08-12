create or replace function public.update_notification_preferences(
  p_email_order_updates boolean,
  p_email_event_updates boolean,
  p_email_store_updates boolean
)
returns public.notification_preferences
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_preferences public.notification_preferences;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_email_order_updates is distinct from true then
    raise exception 'ORDER_EMAIL_REQUIRED';
  end if;

  insert into public.notification_preferences (
    user_id, email_order_updates, email_event_updates, email_store_updates
  ) values (
    v_user_id, true, p_email_event_updates, p_email_store_updates
  )
  on conflict (user_id) do update set
    email_order_updates = true,
    email_event_updates = excluded.email_event_updates,
    email_store_updates = excluded.email_store_updates,
    updated_at = now()
  returning * into v_preferences;
  return v_preferences;
end;
$$;
