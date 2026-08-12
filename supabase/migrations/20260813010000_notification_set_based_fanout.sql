create or replace function public.enqueue_role_notifications(
  p_recipient_role text,
  p_kind text,
  p_title_vi text,
  p_title_en text,
  p_body_vi text,
  p_body_en text,
  p_href text,
  p_source_type text,
  p_source_id text,
  p_dedupe_key text,
  p_email_category text,
  p_email_enabled boolean default true
)
returns integer
language sql
security definer
set search_path = ''
as $$
with inserted as (
  insert into public.notifications (
    recipient_user_id, kind, title_vi, title_en, body_vi, body_en,
    href, source_type, source_id, dedupe_key
  )
  select
    profiles.id, p_kind, p_title_vi, p_title_en, p_body_vi, p_body_en,
    p_href, p_source_type, p_source_id, p_dedupe_key
  from public.profiles as profiles
  where profiles.role::text = p_recipient_role
  on conflict (recipient_user_id, dedupe_key) do nothing
  returning id, recipient_user_id
), eligible as (
  select
    inserted.id as notification_id,
    inserted.recipient_user_id,
    lower(coalesce(nullif(trim(profiles.email), ''), users.email)) as recipient_email
  from inserted
  join public.profiles as profiles on profiles.id = inserted.recipient_user_id
  left join auth.users as users on users.id = profiles.id
  left join public.notification_preferences as preferences on preferences.user_id = profiles.id
  where coalesce(p_email_enabled, false)
    and case p_email_category
      when 'order' then coalesce(preferences.email_order_updates, true)
      when 'event' then coalesce(preferences.email_event_updates, false)
      when 'store' then coalesce(preferences.email_store_updates, false)
      else false
    end
    and lower(coalesce(nullif(trim(profiles.email), ''), users.email)) is not null
    and not exists (
      select 1
      from public.email_suppressions as suppressions
      where suppressions.email = lower(coalesce(nullif(trim(profiles.email), ''), users.email))
        and suppressions.reason in ('bounced', 'complained')
    )
), queued as (
  insert into public.email_outbox (notification_id, recipient_user_id, recipient_email)
  select notification_id, recipient_user_id, recipient_email
  from eligible
  on conflict (notification_id) do nothing
  returning id
)
select count(*)::integer from inserted;
$$;

revoke all on function public.enqueue_role_notifications(text, text, text, text, text, text, text, text, text, text, text, boolean)
from public, anon, authenticated;

create or replace function public.publish_store_announcement(
  p_title_vi text,
  p_title_en text,
  p_body_vi text,
  p_body_en text,
  p_href text,
  p_send_email boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_announcement_id uuid;
begin
  if v_actor_id is null or (select public.current_user_role()) is distinct from 'admin' then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if char_length(trim(p_title_vi)) not between 3 and 180
    or char_length(trim(p_title_en)) not between 3 and 180
    or char_length(trim(p_body_vi)) not between 10 and 1000
    or char_length(trim(p_body_en)) not between 10 and 1000
    or (p_href is not null and (left(trim(p_href), 1) <> '/' or left(trim(p_href), 2) = '//')) then
    raise exception 'INVALID_ANNOUNCEMENT';
  end if;

  insert into public.store_announcements (
    title_vi, title_en, body_vi, body_en, href, send_email, created_by
  ) values (
    trim(p_title_vi), trim(p_title_en), trim(p_body_vi), trim(p_body_en), nullif(trim(p_href), ''),
    coalesce(p_send_email, false), v_actor_id
  ) returning id into v_announcement_id;

  perform public.enqueue_role_notifications(
    'member',
    'store_announcement',
    trim(p_title_vi),
    trim(p_title_en),
    trim(p_body_vi),
    trim(p_body_en),
    nullif(trim(p_href), ''),
    'store_announcement',
    v_announcement_id::text,
    'store_announcement:' || v_announcement_id::text,
    'store',
    coalesce(p_send_email, false)
  );

  return v_announcement_id;
end;
$$;

create or replace function public.notify_new_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.enqueue_role_notifications(
    'admin',
    'order_created',
    'Có đơn hàng mới',
    'New order received',
    format('Đơn %s từ %s, tổng %sđ.', new.order_code, new.customer_name, to_char(new.total_vnd, 'FM999G999G999')),
    format('Order %s from %s, total %s VND.', new.order_code, new.customer_name, to_char(new.total_vnd, 'FM999G999G999')),
    '/admin/orders/' || new.id::text,
    'order',
    new.id::text,
    'order_created:' || new.id::text,
    'order',
    true
  );
  return new;
end;
$$;

create or replace function public.notify_event_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_published is distinct from true then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.is_published is distinct from false then
    return new;
  end if;

  perform public.enqueue_role_notifications(
    'member',
    'event_published',
    'Sự kiện mới tại Beanbus',
    'New Beanbus event',
    new.title_vi,
    new.title_en,
    '/events/' || new.slug,
    'event',
    new.id,
    'event_published:' || new.id,
    'event',
    true
  );
  return new;
end;
$$;

create or replace function public.notify_new_booking_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.enqueue_role_notifications(
    'admin',
    'booking_request_created',
    'Có yêu cầu đặt bàn mới',
    'New booking request',
    format('Yêu cầu #%s từ %s cho %s khách.', new.reference_number, new.customer_name, new.guest_count),
    format('Booking request #%s from %s for %s guests.', new.reference_number, new.customer_name, new.guest_count),
    '/admin/requests/' || new.id::text || '?kind=booking',
    'booking_request',
    new.id::text,
    'booking_request_created:' || new.id::text,
    'order',
    true
  );
  return new;
end;
$$;

create or replace function public.notify_new_customer_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.enqueue_role_notifications(
    'admin',
    'customer_request_created',
    'Có yêu cầu mới từ khách hàng',
    'New customer request',
    format('Yêu cầu #%s (%s) từ %s.', new.reference_number, new.request_type, new.contact_name),
    format('Request #%s (%s) from %s.', new.reference_number, new.request_type, new.contact_name),
    '/admin/requests/' || new.id::text || '?kind=customer',
    'customer_request',
    new.id::text,
    'customer_request_created:' || new.id::text,
    'order',
    true
  );
  return new;
end;
$$;
