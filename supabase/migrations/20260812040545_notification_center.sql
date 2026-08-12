create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('order_created', 'order_status_changed', 'event_published', 'store_announcement')),
  title_vi text not null check (char_length(title_vi) between 1 and 180),
  title_en text not null check (char_length(title_en) between 1 and 180),
  body_vi text not null check (char_length(body_vi) between 1 and 1000),
  body_en text not null check (char_length(body_en) between 1 and 1000),
  href text check (href is null or (left(href, 1) = '/' and left(href, 2) <> '//')),
  source_type text not null check (source_type in ('order', 'event', 'store_announcement')),
  source_id text not null check (char_length(source_id) between 1 and 120),
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 255),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (recipient_user_id, dedupe_key)
);

create index notifications_recipient_created_idx
on public.notifications (recipient_user_id, created_at desc);

create index notifications_unread_idx
on public.notifications (recipient_user_id, created_at desc)
where read_at is null;

create table public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email_order_updates boolean not null default true,
  email_event_updates boolean not null default false,
  email_store_updates boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

create table public.store_announcements (
  id uuid primary key default gen_random_uuid(),
  title_vi text not null check (char_length(title_vi) between 3 and 180),
  title_en text not null check (char_length(title_en) between 3 and 180),
  body_vi text not null check (char_length(body_vi) between 10 and 1000),
  body_en text not null check (char_length(body_en) between 10 and 1000),
  href text check (href is null or (left(href, 1) = '/' and left(href, 2) <> '//')),
  send_email boolean not null default false,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index store_announcements_created_idx
on public.store_announcements (created_at desc);

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique references public.notifications (id) on delete cascade,
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  recipient_email text not null check (char_length(recipient_email) between 3 and 320),
  status text not null default 'pending' check (status in ('pending', 'processing', 'accepted', 'delivered', 'failed', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  locked_until timestamptz,
  locked_by uuid,
  provider_message_id text,
  last_error_code text check (last_error_code is null or char_length(last_error_code) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index email_outbox_claim_idx
on public.email_outbox (available_at, created_at)
where status = 'pending';

create trigger email_outbox_set_updated_at
before update on public.email_outbox
for each row execute function public.set_updated_at();

create table public.email_delivery_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique check (char_length(provider_event_id) between 1 and 255),
  provider_message_id text not null,
  event_type text not null check (event_type in ('email.sent', 'email.delivered', 'email.bounced', 'email.complained')),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index email_delivery_events_message_idx
on public.email_delivery_events (provider_message_id, occurred_at desc);

create table public.email_suppressions (
  email text primary key check (email = lower(trim(email))),
  reason text not null check (reason in ('bounced', 'complained')),
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.store_announcements enable row level security;
alter table public.email_outbox enable row level security;
alter table public.email_delivery_events enable row level security;
alter table public.email_suppressions enable row level security;

revoke all on table public.notifications, public.notification_preferences, public.store_announcements
from anon, authenticated;
revoke all on table public.email_outbox, public.email_delivery_events, public.email_suppressions
from anon, authenticated;
grant select on table public.notifications, public.notification_preferences to authenticated;
grant select on table public.store_announcements to authenticated;
grant all on table public.notifications, public.notification_preferences, public.store_announcements,
  public.email_outbox, public.email_delivery_events, public.email_suppressions to service_role;

create policy "Members read their notifications"
on public.notifications for select to authenticated
using ((select auth.uid()) = recipient_user_id);

create policy "Members read their notification preferences"
on public.notification_preferences for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Admins read store announcements"
on public.store_announcements for select to authenticated
using ((select public.current_user_role()) = 'admin');

create or replace function public.enqueue_user_notification(
  p_recipient_user_id uuid,
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
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notification_id uuid;
  v_email text;
  v_email_allowed boolean;
begin
  if p_recipient_user_id is null then return null; end if;

  insert into public.notifications (
    recipient_user_id, kind, title_vi, title_en, body_vi, body_en,
    href, source_type, source_id, dedupe_key
  ) values (
    p_recipient_user_id, p_kind, p_title_vi, p_title_en, p_body_vi, p_body_en,
    p_href, p_source_type, p_source_id, p_dedupe_key
  )
  on conflict (recipient_user_id, dedupe_key) do nothing
  returning id into v_notification_id;

  if v_notification_id is null then return null; end if;

  select lower(coalesce(profiles.email, users.email))
  into v_email
  from public.profiles
  left join auth.users as users on users.id = profiles.id
  where profiles.id = p_recipient_user_id;

  select case p_email_category
    when 'order' then coalesce(preferences.email_order_updates, true)
    when 'event' then coalesce(preferences.email_event_updates, false)
    when 'store' then coalesce(preferences.email_store_updates, false)
    else false
  end
  into v_email_allowed
  from public.profiles
  left join public.notification_preferences as preferences on preferences.user_id = profiles.id
  where profiles.id = p_recipient_user_id;

  if coalesce(p_email_enabled, false)
    and coalesce(v_email_allowed, false)
    and v_email is not null
    and not exists (
      select 1 from public.email_suppressions
      where email = v_email and reason in ('bounced', 'complained')
    ) then
    insert into public.email_outbox (notification_id, recipient_user_id, recipient_email)
    values (v_notification_id, p_recipient_user_id, v_email)
    on conflict (notification_id) do nothing;
  end if;

  return v_notification_id;
end;
$$;

revoke all on function public.enqueue_user_notification(uuid, text, text, text, text, text, text, text, text, text, text, boolean)
from public, anon, authenticated;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then return false; end if;
  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and recipient_user_id = (select auth.uid());
  return found;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if (select auth.uid()) is null then return 0; end if;
  update public.notifications
  set read_at = now()
  where recipient_user_id = (select auth.uid()) and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

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
  v_profile record;
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

  for v_profile in
    select id from public.profiles where role = 'member'
  loop
    perform public.enqueue_user_notification(
      v_profile.id,
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
  end loop;

  return v_announcement_id;
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public, anon, authenticated;
revoke all on function public.mark_all_notifications_read() from public, anon, authenticated;
revoke all on function public.update_notification_preferences(boolean, boolean, boolean) from public, anon, authenticated;
revoke all on function public.publish_store_announcement(text, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.update_notification_preferences(boolean, boolean, boolean) to authenticated;
grant execute on function public.publish_store_announcement(text, text, text, text, text, boolean) to authenticated;

create or replace function public.notify_new_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin record;
begin
  for v_admin in select id from public.profiles where role = 'admin' loop
    perform public.enqueue_user_notification(
      v_admin.id,
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
  end loop;
  return new;
end;
$$;

create or replace function public.notify_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is null or new.status is not distinct from old.status then return new; end if;

  perform public.enqueue_user_notification(
    new.user_id,
    'order_status_changed',
    'Đơn hàng đã cập nhật',
    'Order status updated',
    format('Đơn %s đang ở trạng thái %s.', new.order_code, new.status::text),
    format('Order %s is now %s.', new.order_code, new.status::text),
    '/account/orders/' || new.id::text,
    'order',
    new.id::text,
    'order_status:' || new.id::text || ':' || new.status::text,
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
declare
  v_profile record;
begin
  if new.is_published is distinct from true then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.is_published is distinct from false then
      return new;
    end if;
  end if;

  for v_profile in select id from public.profiles where role = 'member' loop
    perform public.enqueue_user_notification(
      v_profile.id,
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
  end loop;
  return new;
end;
$$;

revoke all on function public.notify_new_order() from public, anon, authenticated;
revoke all on function public.notify_order_status_change() from public, anon, authenticated;
revoke all on function public.notify_event_published() from public, anon, authenticated;

create trigger orders_create_notifications
after insert on public.orders
for each row execute function public.notify_new_order();

create trigger orders_status_create_notifications
after update of status on public.orders
for each row execute function public.notify_order_status_change();

create trigger events_publish_notifications
after insert or update of is_published on public.events
for each row execute function public.notify_event_published();

create or replace function public.claim_notification_email_batch(p_limit integer, p_worker_id uuid)
returns setof public.email_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.email_outbox as outbox
  set status = 'cancelled',
      last_error_code = case
        when exists (
          select 1
          from public.email_suppressions as suppression
          where suppression.email = lower(trim(outbox.recipient_email))
        ) then 'EMAIL_SUPPRESSED'
        else 'EMAIL_UNSUBSCRIBED'
      end,
      locked_until = null,
      locked_by = null,
      updated_at = now()
  where (
    (outbox.status = 'pending' and outbox.available_at <= now())
    or (outbox.status = 'processing' and outbox.locked_until < now())
  )
  and (
    exists (
      select 1
      from public.email_suppressions as suppression
      where suppression.email = lower(trim(outbox.recipient_email))
    )
    or exists (
      select 1
      from public.notifications as notification
      left join public.notification_preferences as preferences
        on preferences.user_id = notification.recipient_user_id
      where notification.id = outbox.notification_id
        and notification.kind in ('event_published', 'store_announcement')
        and case notification.kind
          when 'event_published' then coalesce(preferences.email_event_updates, false)
          when 'store_announcement' then coalesce(preferences.email_store_updates, false)
          else true
        end = false
    )
  );

  return query
  with candidates as (
    select outbox.id
    from public.email_outbox as outbox
    where (
      (outbox.status = 'pending' and outbox.available_at <= now())
      or (outbox.status = 'processing' and outbox.locked_until < now())
    )
    and not exists (
      select 1
      from public.email_suppressions as suppression
      where suppression.email = lower(trim(outbox.recipient_email))
    )
    and not exists (
      select 1
      from public.notifications as notification
      left join public.notification_preferences as preferences
        on preferences.user_id = notification.recipient_user_id
      where notification.id = outbox.notification_id
        and notification.kind in ('event_published', 'store_announcement')
        and case notification.kind
          when 'event_published' then coalesce(preferences.email_event_updates, false)
          when 'store_announcement' then coalesce(preferences.email_store_updates, false)
          else true
        end = false
    )
    order by outbox.created_at
    limit least(greatest(coalesce(p_limit, 50), 1), 50)
    for update skip locked
  )
  update public.email_outbox as outbox
  set status = 'processing',
      attempt_count = outbox.attempt_count + 1,
      locked_until = now() + interval '2 minutes',
      locked_by = p_worker_id,
      updated_at = now()
  from candidates
  where outbox.id = candidates.id
  returning outbox.*;
end;
$$;

create or replace function public.complete_notification_email(p_outbox_id uuid, p_provider_message_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if p_provider_message_id is null or char_length(trim(p_provider_message_id)) = 0 then
    raise exception 'INVALID_PROVIDER_MESSAGE_ID';
  end if;

  update public.email_outbox as outbox
  set status = case
        when exists (
          select 1 from public.email_delivery_events as delivery
          where delivery.provider_message_id = p_provider_message_id
            and delivery.event_type in ('email.bounced', 'email.complained')
        ) then 'failed'
        when exists (
          select 1 from public.email_delivery_events as delivery
          where delivery.provider_message_id = p_provider_message_id
            and delivery.event_type = 'email.delivered'
        ) then 'delivered'
        else 'accepted'
      end,
      provider_message_id = p_provider_message_id,
      locked_until = null,
      locked_by = null,
      updated_at = now()
  where outbox.id = p_outbox_id and outbox.status = 'processing'
  returning lower(trim(outbox.recipient_email)) into v_email;

  if not found then return false; end if;

  if exists (
    select 1 from public.email_delivery_events as delivery
    where delivery.provider_message_id = p_provider_message_id
      and delivery.event_type in ('email.bounced', 'email.complained')
  ) then
    insert into public.email_suppressions (email, reason)
    select v_email,
      case when exists (
        select 1 from public.email_delivery_events as delivery
        where delivery.provider_message_id = p_provider_message_id
          and delivery.event_type = 'email.complained'
      ) then 'complained' else 'bounced' end
    on conflict (email) do update set reason = excluded.reason;

    update public.email_outbox as outbox
    set status = 'cancelled',
        last_error_code = 'EMAIL_SUPPRESSED',
        locked_until = null,
        locked_by = null,
        updated_at = now()
    where lower(trim(outbox.recipient_email)) = v_email
      and outbox.status = 'pending'
      and outbox.notification_id <> p_outbox_id;
  end if;

  return true;
end;
$$;

create or replace function public.fail_notification_email(p_outbox_id uuid, p_retryable boolean, p_error_code text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  update public.email_outbox
  set status = case when p_retryable and attempt_count < 5 then 'pending' else 'failed' end,
      available_at = case when p_retryable and attempt_count < 5 then
        now() + case attempt_count when 1 then interval '1 minute' when 2 then interval '5 minutes' when 3 then interval '30 minutes' else interval '2 hours' end
        else available_at end,
      last_error_code = nullif(left(p_error_code, 120), ''),
      locked_until = null, locked_by = null, updated_at = now()
  where id = p_outbox_id and status = 'processing'
  returning true;
$$;

create or replace function public.record_email_delivery_event(
  p_provider_event_id text,
  p_provider_message_id text,
  p_event_type text,
  p_occurred_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_outbox public.email_outbox;
begin
  if p_provider_event_id is null or p_provider_message_id is null
    or p_event_type not in ('email.sent', 'email.delivered', 'email.bounced', 'email.complained') then
    raise exception 'INVALID_DELIVERY_EVENT';
  end if;

  insert into public.email_delivery_events (provider_event_id, provider_message_id, event_type, occurred_at)
  values (p_provider_event_id, p_provider_message_id, p_event_type, coalesce(p_occurred_at, now()))
  on conflict (provider_event_id) do nothing;
  if not found then return false; end if;

  select * into v_outbox from public.email_outbox
  where provider_message_id = p_provider_message_id
  order by created_at desc limit 1;
  if not found then return true; end if;

  if p_event_type = 'email.delivered' then
    update public.email_outbox set status = 'delivered', locked_until = null, locked_by = null, updated_at = now()
    where id = v_outbox.id
      and not exists (
        select 1
        from public.email_delivery_events as prior
        where prior.provider_message_id = p_provider_message_id
          and prior.event_type in ('email.bounced', 'email.complained')
          and prior.provider_event_id <> p_provider_event_id
      );
  elsif p_event_type in ('email.bounced', 'email.complained') then
    update public.email_outbox set status = 'failed', last_error_code = p_event_type, locked_until = null, locked_by = null, updated_at = now()
    where id = v_outbox.id;
    insert into public.email_suppressions (email, reason)
    values (lower(trim(v_outbox.recipient_email)), case when p_event_type = 'email.bounced' then 'bounced' else 'complained' end)
    on conflict (email) do update set reason = excluded.reason;
    update public.email_outbox as outbox
    set status = 'cancelled',
        last_error_code = 'EMAIL_SUPPRESSED',
        locked_until = null,
        locked_by = null,
        updated_at = now()
    where lower(trim(outbox.recipient_email)) = lower(trim(v_outbox.recipient_email))
      and outbox.status = 'pending'
      and outbox.id <> v_outbox.id;
  end if;
  return true;
end;
$$;

revoke all on function public.claim_notification_email_batch(integer, uuid) from public, anon, authenticated;
revoke all on function public.complete_notification_email(uuid, text) from public, anon, authenticated;
revoke all on function public.fail_notification_email(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.record_email_delivery_event(text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_notification_email_batch(integer, uuid) to service_role;
grant execute on function public.complete_notification_email(uuid, text) to service_role;
grant execute on function public.fail_notification_email(uuid, boolean, text) to service_role;
grant execute on function public.record_email_delivery_event(text, text, text, timestamptz) to service_role;

create or replace function public.revoke_email_subscription(p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
begin
  if v_email is null or char_length(v_email) < 3 then raise exception 'INVALID_EMAIL'; end if;
  update public.notification_preferences as preferences
  set email_event_updates = false, email_store_updates = false, updated_at = now()
  from public.profiles as profiles
  left join auth.users as users on users.id = profiles.id
  where preferences.user_id = profiles.id
    and lower(coalesce(nullif(trim(profiles.email), ''), users.email, '')) = v_email;
  update public.email_outbox as outbox
  set status = 'cancelled',
      last_error_code = 'EMAIL_UNSUBSCRIBED',
      locked_until = null,
      locked_by = null,
      updated_at = now()
  where lower(trim(outbox.recipient_email)) = v_email
    and outbox.status = 'pending'
    and exists (
      select 1
      from public.notifications as notification
      where notification.id = outbox.notification_id
        and notification.kind in ('event_published', 'store_announcement')
    );
  return true;
end;
$$;

revoke all on function public.revoke_email_subscription(text) from public, anon, authenticated;
grant execute on function public.revoke_email_subscription(text) to service_role;

create or replace function public.get_admin_notification_summary()
returns table (unread_count bigint, failed_email_count bigint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or (select public.current_user_role()) is distinct from 'admin' then
    raise exception 'ADMIN_REQUIRED';
  end if;
  return query
  select
    (select count(*) from public.notifications where recipient_user_id = (select auth.uid()) and read_at is null),
    (select count(*) from public.email_outbox where status = 'failed');
end;
$$;

create or replace function public.get_admin_notification_failures(p_limit integer default 50)
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
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

revoke all on function public.get_admin_notification_summary() from public, anon, authenticated;
revoke all on function public.get_admin_notification_failures(integer) from public, anon, authenticated;
grant execute on function public.get_admin_notification_summary() to authenticated;
grant execute on function public.get_admin_notification_failures(integer) to authenticated;

create extension if not exists supabase_vault with schema vault;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;
revoke all on schema vault from public, anon, authenticated, service_role;
revoke all on table vault.secrets from public, anon, authenticated, service_role;
revoke all on table vault.decrypted_secrets from public, anon, authenticated, service_role;

create or replace function private.invoke_notification_email_dispatch()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_url text;
  v_job_secret text;
  v_request_id bigint;
begin
  select decrypted_secret into v_project_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_job_secret from vault.decrypted_secrets where name = 'notification_worker_secret';
  if v_project_url is null or v_job_secret is null then return null; end if;
  select net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/dispatch-notification-emails',
    headers := jsonb_build_object('content-type', 'application/json', 'x-notification-worker-secret', v_job_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) into v_request_id;
  return v_request_id;
end;
$$;

revoke all on function private.invoke_notification_email_dispatch() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'beanbus-dispatch-notification-emails') then
    perform cron.schedule('beanbus-dispatch-notification-emails', '* * * * *', 'select private.invoke_notification_email_dispatch()');
  end if;
end;
$$;

alter publication supabase_realtime add table public.notifications;
