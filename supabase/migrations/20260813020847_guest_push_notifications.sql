alter table public.notifications
  drop constraint if exists notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check
  check (kind in (
    'order_created',
    'order_status_changed',
    'order_payment_changed',
    'event_published',
    'store_announcement',
    'booking_request_created',
    'booking_request_status_changed',
    'customer_request_created',
    'customer_request_status_changed'
  ));

alter table public.notification_preferences
  add column push_order_updates boolean not null default true,
  add column push_request_updates boolean not null default true,
  add column push_event_updates boolean not null default false,
  add column push_store_updates boolean not null default false;

create table public.guest_notification_sessions (
  id uuid primary key,
  expires_at timestamptz not null default (now() + interval '7 days'),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index guest_notification_sessions_expiry_idx
on public.guest_notification_sessions (expires_at);

create table public.guest_order_access (
  guest_session_id uuid not null references public.guest_notification_sessions (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (guest_session_id, order_id),
  unique (order_id)
);

create index guest_order_access_session_created_idx
on public.guest_order_access (guest_session_id, created_at desc);

create table public.guest_notifications (
  id uuid primary key default gen_random_uuid(),
  guest_session_id uuid not null references public.guest_notification_sessions (id) on delete cascade,
  kind text not null check (kind in ('order_status_changed', 'order_payment_changed')),
  title_vi text not null check (char_length(title_vi) between 1 and 180),
  title_en text not null check (char_length(title_en) between 1 and 180),
  body_vi text not null check (char_length(body_vi) between 1 and 1000),
  body_en text not null check (char_length(body_en) between 1 and 1000),
  href text not null check (href ~ '^/order/guest/[0-9a-f-]{36}$'),
  order_id uuid not null references public.orders (id) on delete cascade,
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 255),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (guest_session_id, dedupe_key)
);

create index guest_notifications_session_created_idx
on public.guest_notifications (guest_session_id, created_at desc);

create index guest_notifications_unread_idx
on public.guest_notifications (guest_session_id, created_at desc)
where read_at is null;

create table public.fcm_installations (
  id uuid primary key default gen_random_uuid(),
  fid text not null unique check (
    char_length(fid) between 20 and 256 and fid ~ '^[A-Za-z0-9_-]+$'
  ),
  locale text not null default 'vi' check (locale in ('vi', 'en')),
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index fcm_installations_active_seen_idx
on public.fcm_installations (last_seen_at)
where active;

create trigger fcm_installations_set_updated_at
before update on public.fcm_installations
for each row execute function public.set_updated_at();

create table public.fcm_installation_recipients (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null references public.fcm_installations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  guest_session_id uuid references public.guest_notification_sessions (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(user_id, guest_session_id) = 1),
  unique (installation_id, user_id),
  unique (installation_id, guest_session_id)
);

create index fcm_installation_recipients_user_idx
on public.fcm_installation_recipients (user_id, installation_id)
where user_id is not null;

create index fcm_installation_recipients_guest_idx
on public.fcm_installation_recipients (guest_session_id, installation_id)
where guest_session_id is not null;

create table public.push_outbox (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null references public.fcm_installations (id) on delete cascade,
  notification_id uuid references public.notifications (id) on delete cascade,
  guest_notification_id uuid references public.guest_notifications (id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 4096),
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  available_at timestamptz not null default now(),
  locked_until timestamptz,
  locked_by uuid,
  provider_message_id text check (provider_message_id is null or char_length(provider_message_id) <= 255),
  last_error_code text check (last_error_code is null or char_length(last_error_code) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(notification_id, guest_notification_id) = 1),
  unique (installation_id, notification_id),
  unique (installation_id, guest_notification_id)
);

create index push_outbox_claim_idx
on public.push_outbox (available_at, created_at)
where status = 'pending';

create trigger push_outbox_set_updated_at
before update on public.push_outbox
for each row execute function public.set_updated_at();

alter table public.guest_notification_sessions enable row level security;
alter table public.guest_order_access enable row level security;
alter table public.guest_notifications enable row level security;
alter table public.fcm_installations enable row level security;
alter table public.fcm_installation_recipients enable row level security;
alter table public.push_outbox enable row level security;

revoke all on table
  public.guest_notification_sessions,
  public.guest_order_access,
  public.guest_notifications,
  public.fcm_installations,
  public.fcm_installation_recipients,
  public.push_outbox
from anon, authenticated;

grant all on table
  public.guest_notification_sessions,
  public.guest_order_access,
  public.guest_notifications,
  public.fcm_installations,
  public.fcm_installation_recipients,
  public.push_outbox
to service_role;

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
    order by recipient.created_at asc, recipient.id asc
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

create or replace function public.link_guest_order_notifications(
  p_guest_session_id uuid,
  p_order_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_guest_session_id is null or p_order_id is null then return false; end if;
  if not exists (
    select 1 from public.orders
    where id = p_order_id and user_id is null and receipt_token is not null
  ) then return false; end if;
  if exists (
    select 1 from public.guest_order_access
    where order_id = p_order_id and guest_session_id <> p_guest_session_id
  ) then return false; end if;

  insert into public.guest_notification_sessions (id)
  values (p_guest_session_id)
  on conflict (id) do update set
    expires_at = greatest(public.guest_notification_sessions.expires_at, now() + interval '7 days'),
    last_seen_at = now();

  insert into public.guest_order_access (guest_session_id, order_id, created_at)
  values (p_guest_session_id, p_order_id, clock_timestamp())
  on conflict (guest_session_id, order_id) do update
  set created_at = excluded.created_at;

  with removed as (
    delete from public.guest_order_access as access
    where access.guest_session_id = p_guest_session_id
      and access.order_id in (
        select older.order_id
        from public.guest_order_access as older
        where older.guest_session_id = p_guest_session_id
        order by older.created_at desc, older.order_id desc
        offset 5
      )
    returning access.order_id
  )
  delete from public.guest_notifications as notification
  where notification.guest_session_id = p_guest_session_id
    and notification.order_id in (select removed.order_id from removed);

  return true;
end;
$$;

create or replace function public.register_fcm_installation(
  p_fid text,
  p_locale text,
  p_user_id uuid,
  p_guest_session_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_installation_id uuid;
begin
  if p_fid is null or char_length(p_fid) not between 20 and 256 or p_fid !~ '^[A-Za-z0-9_-]+$'
    or p_locale not in ('vi', 'en')
    or (p_user_id is null and p_guest_session_id is null) then
    raise exception 'INVALID_INSTALLATION';
  end if;
  if p_guest_session_id is not null and not exists (
    select 1 from public.guest_notification_sessions
    where id = p_guest_session_id and expires_at > now()
  ) then raise exception 'INVALID_GUEST_SESSION'; end if;

  if p_user_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('fcm:user:' || p_user_id::text, 0));
  end if;
  if p_guest_session_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('fcm:guest:' || p_guest_session_id::text, 0));
  end if;

  insert into public.fcm_installations (fid, locale)
  values (p_fid, p_locale)
  on conflict (fid) do update set
    locale = excluded.locale,
    active = true,
    last_seen_at = now(),
    updated_at = now()
  returning id into v_installation_id;

  if p_user_id is not null then
    delete from public.fcm_installation_recipients
    where installation_id = v_installation_id
      and user_id is not null
      and user_id <> p_user_id;
    insert into public.fcm_installation_recipients (installation_id, user_id)
    values (v_installation_id, p_user_id)
    on conflict (installation_id, user_id) do nothing;
    perform private.trim_fcm_installation_recipients(p_user_id, null, 10);
  end if;
  if p_guest_session_id is not null then
    insert into public.fcm_installation_recipients (installation_id, guest_session_id)
    values (v_installation_id, p_guest_session_id)
    on conflict (installation_id, guest_session_id) do nothing;
    perform private.trim_fcm_installation_recipients(null, p_guest_session_id, 3);
  end if;

  return v_installation_id;
end;
$$;

create or replace function public.unlink_fcm_installation(
  p_fid text,
  p_user_id uuid,
  p_guest_session_id uuid,
  p_disable boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_installation_id uuid;
begin
  select id into v_installation_id from public.fcm_installations where fid = p_fid;
  if v_installation_id is null then return false; end if;

  if coalesce(p_disable, false) then
    if not exists (
      select 1 from public.fcm_installation_recipients
      where installation_id = v_installation_id
        and ((p_user_id is not null and user_id = p_user_id)
          or (p_guest_session_id is not null and guest_session_id = p_guest_session_id))
    ) then return false; end if;
    delete from public.fcm_installation_recipients where installation_id = v_installation_id;
    update public.fcm_installations set active = false where id = v_installation_id;
  else
    delete from public.fcm_installation_recipients
    where installation_id = v_installation_id
      and ((p_user_id is not null and user_id = p_user_id)
        or (p_guest_session_id is not null and guest_session_id = p_guest_session_id));
    update public.fcm_installations as installation
    set active = exists (
      select 1 from public.fcm_installation_recipients as recipient
      where recipient.installation_id = installation.id
    )
    where installation.id = v_installation_id;
  end if;
  return true;
end;
$$;

create or replace function public.unlink_user_fcm_installations(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.fcm_installation_recipients where user_id = p_user_id;
  get diagnostics v_count = row_count;
  update public.fcm_installations as installation
  set active = false, updated_at = now()
  where installation.active
    and not exists (
      select 1 from public.fcm_installation_recipients as recipient
      where recipient.installation_id = installation.id
    );
  return v_count;
end;
$$;

revoke all on function public.link_guest_order_notifications(uuid, uuid) from public, anon, authenticated;
revoke all on function public.register_fcm_installation(text, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.unlink_fcm_installation(text, uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.unlink_user_fcm_installations(uuid) from public, anon, authenticated;
grant execute on function public.link_guest_order_notifications(uuid, uuid) to service_role;
grant execute on function public.register_fcm_installation(text, text, uuid, uuid) to service_role;
grant execute on function public.unlink_fcm_installation(text, uuid, uuid, boolean) to service_role;
grant execute on function public.unlink_user_fcm_installations(uuid) to service_role;

create or replace function public.mark_guest_notifications_read(
  p_guest_session_id uuid,
  p_notification_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.guest_notifications
  set read_at = now()
  where guest_session_id = p_guest_session_id
    and read_at is null
    and (p_notification_id is null or id = p_notification_id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_guest_notifications_read(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mark_guest_notifications_read(uuid, uuid) to service_role;

create or replace function public.enqueue_push_for_user_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.push_outbox (installation_id, notification_id, payload)
  select
    installation.id,
    new.id,
    jsonb_build_object(
      'titleVi', new.title_vi,
      'titleEn', new.title_en,
      'bodyVi', case
        when new.source_type = 'order' then coalesce(
          (select format('Đơn %s đã có cập nhật mới.', orders.order_code) from public.orders where orders.id::text = new.source_id),
          'Đơn hàng đã có cập nhật mới.'
        )
        when new.source_type in ('booking_request', 'customer_request') then 'Yêu cầu của bạn đã có cập nhật mới.'
        else left(new.body_vi, 240)
      end,
      'bodyEn', case
        when new.source_type = 'order' then coalesce(
          (select format('Order %s has a new update.', orders.order_code) from public.orders where orders.id::text = new.source_id),
          'Your order has a new update.'
        )
        when new.source_type in ('booking_request', 'customer_request') then 'Your request has a new update.'
        else left(new.body_en, 240)
      end,
      'href', new.href,
      'kind', new.kind,
      'tag', new.dedupe_key
    )
  from public.fcm_installation_recipients as recipient
  join public.fcm_installations as installation
    on installation.id = recipient.installation_id
  left join public.notification_preferences as preferences
    on preferences.user_id = new.recipient_user_id
  where recipient.user_id = new.recipient_user_id
    and installation.active
    and installation.last_seen_at >= now() - interval '30 days'
    and case
      when new.kind = 'event_published' then coalesce(preferences.push_event_updates, false)
      when new.kind = 'store_announcement' then coalesce(preferences.push_store_updates, false)
      when new.kind in ('booking_request_status_changed', 'customer_request_status_changed')
        then coalesce(preferences.push_request_updates, true)
      else coalesce(preferences.push_order_updates, true)
    end
  on conflict (installation_id, notification_id) do nothing;
  return new;
end;
$$;

create or replace function public.enqueue_push_for_guest_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.push_outbox (installation_id, guest_notification_id, payload)
  select
    installation.id,
    new.id,
    jsonb_build_object(
      'titleVi', new.title_vi,
      'titleEn', new.title_en,
      'bodyVi', new.body_vi,
      'bodyEn', new.body_en,
      'href', new.href,
      'kind', new.kind,
      'tag', new.dedupe_key
    )
  from public.fcm_installation_recipients as recipient
  join public.fcm_installations as installation
    on installation.id = recipient.installation_id
  where recipient.guest_session_id = new.guest_session_id
    and installation.active
    and installation.last_seen_at >= now() - interval '30 days'
  on conflict (installation_id, guest_notification_id) do nothing;
  return new;
end;
$$;

revoke all on function public.enqueue_push_for_user_notification() from public, anon, authenticated;
revoke all on function public.enqueue_push_for_guest_notification() from public, anon, authenticated;

create trigger notifications_enqueue_push
after insert on public.notifications
for each row execute function public.enqueue_push_for_user_notification();

create trigger guest_notifications_enqueue_push
after insert on public.guest_notifications
for each row execute function public.enqueue_push_for_guest_notification();

create or replace function public.notify_order_status_and_payment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.user_id is not null then
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
    end if;

    insert into public.guest_notifications (
      guest_session_id, kind, title_vi, title_en, body_vi, body_en, href, order_id, dedupe_key
    )
    select
      access.guest_session_id,
      'order_status_changed',
      'Đơn hàng đã cập nhật',
      'Order status updated',
      format('Đơn %s đang ở trạng thái %s.', new.order_code, new.status::text),
      format('Order %s is now %s.', new.order_code, new.status::text),
      '/order/guest/' || new.id::text,
      new.id,
      'order_status:' || new.id::text || ':' || new.status::text
    from public.guest_order_access as access
    join public.guest_notification_sessions as session on session.id = access.guest_session_id
    where access.order_id = new.id and session.expires_at > now()
    on conflict (guest_session_id, dedupe_key) do nothing;
  end if;

  if new.payment_status is distinct from old.payment_status then
    if new.user_id is not null then
      perform public.enqueue_user_notification(
        new.user_id,
        'order_payment_changed',
        'Thanh toán đã cập nhật',
        'Payment status updated',
        format('Thanh toán đơn %s đang ở trạng thái %s.', new.order_code, new.payment_status::text),
        format('Payment for order %s is now %s.', new.order_code, new.payment_status::text),
        '/account/orders/' || new.id::text,
        'order',
        new.id::text,
        'order_payment:' || new.id::text || ':' || new.payment_status::text,
        'order',
        true
      );
    end if;

    insert into public.guest_notifications (
      guest_session_id, kind, title_vi, title_en, body_vi, body_en, href, order_id, dedupe_key
    )
    select
      access.guest_session_id,
      'order_payment_changed',
      'Thanh toán đã cập nhật',
      'Payment status updated',
      format('Thanh toán đơn %s đang ở trạng thái %s.', new.order_code, new.payment_status::text),
      format('Payment for order %s is now %s.', new.order_code, new.payment_status::text),
      '/order/guest/' || new.id::text,
      new.id,
      'order_payment:' || new.id::text || ':' || new.payment_status::text
    from public.guest_order_access as access
    join public.guest_notification_sessions as session on session.id = access.guest_session_id
    where access.order_id = new.id and session.expires_at > now()
    on conflict (guest_session_id, dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.notify_order_status_and_payment_change() from public, anon, authenticated;

drop trigger if exists orders_status_create_notifications on public.orders;
create trigger orders_status_create_notifications
after update of status, payment_status on public.orders
for each row execute function public.notify_order_status_and_payment_change();

create or replace function public.notify_booking_request_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is null or new.status is not distinct from old.status then return new; end if;
  perform public.enqueue_user_notification(
    new.user_id,
    'booking_request_status_changed',
    'Đặt bàn đã cập nhật',
    'Booking request updated',
    format('Yêu cầu đặt bàn #%s đang ở trạng thái %s.', new.reference_number, new.status),
    format('Booking request #%s is now %s.', new.reference_number, new.status),
    '/account/requests/' || new.id::text || '?kind=booking',
    'booking_request',
    new.id::text,
    'booking_status:' || new.id::text || ':' || new.status,
    'order',
    true
  );
  return new;
end;
$$;

create or replace function public.notify_customer_request_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is null or new.status is not distinct from old.status then return new; end if;
  perform public.enqueue_user_notification(
    new.user_id,
    'customer_request_status_changed',
    'Yêu cầu đã cập nhật',
    'Customer request updated',
    format('Yêu cầu #%s đang ở trạng thái %s.', new.reference_number, new.status),
    format('Request #%s is now %s.', new.reference_number, new.status),
    '/account/requests/' || new.id::text || '?kind=customer',
    'customer_request',
    new.id::text,
    'customer_request_status:' || new.id::text || ':' || new.status,
    'order',
    true
  );
  return new;
end;
$$;

revoke all on function public.notify_booking_request_status_change() from public, anon, authenticated;
revoke all on function public.notify_customer_request_status_change() from public, anon, authenticated;

create trigger booking_requests_status_notifications
after update of status on public.booking_requests
for each row execute function public.notify_booking_request_status_change();

create trigger customer_requests_status_notifications
after update of status on public.customer_requests
for each row execute function public.notify_customer_request_status_change();

create or replace function public.update_push_notification_preferences(
  p_push_order_updates boolean,
  p_push_request_updates boolean,
  p_push_event_updates boolean,
  p_push_store_updates boolean
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
    user_id, push_order_updates, push_request_updates, push_event_updates, push_store_updates
  ) values (
    v_user_id, coalesce(p_push_order_updates, true), coalesce(p_push_request_updates, true),
    coalesce(p_push_event_updates, false), coalesce(p_push_store_updates, false)
  )
  on conflict (user_id) do update set
    push_order_updates = excluded.push_order_updates,
    push_request_updates = excluded.push_request_updates,
    push_event_updates = excluded.push_event_updates,
    push_store_updates = excluded.push_store_updates,
    updated_at = now()
  returning * into v_preferences;
  return v_preferences;
end;
$$;

revoke all on function public.update_push_notification_preferences(boolean, boolean, boolean, boolean)
from public, anon, authenticated;
grant execute on function public.update_push_notification_preferences(boolean, boolean, boolean, boolean)
to authenticated;

create or replace function public.claim_push_notification_batch(
  p_limit integer,
  p_worker_id uuid,
  p_allowed_fids text[] default null
)
returns table (
  outbox_id uuid,
  installation_id uuid,
  fid text,
  payload jsonb,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.push_outbox as outbox
  set status = 'failed',
      last_error_code = 'LEASE_EXHAUSTED',
      locked_until = null,
      locked_by = null,
      updated_at = now()
  where outbox.status = 'processing'
    and outbox.attempt_count >= 5
    and outbox.locked_until < now();

  update public.push_outbox as outbox
  set status = 'cancelled',
      last_error_code = 'INSTALLATION_INACTIVE',
      locked_until = null,
      locked_by = null,
      updated_at = now()
  where outbox.status in ('pending', 'processing')
    and not exists (
      select 1 from public.fcm_installations as installation
      where installation.id = outbox.installation_id
        and installation.active
        and installation.last_seen_at >= now() - interval '30 days'
    );

  return query
  with candidates as (
    select outbox.id
    from public.push_outbox as outbox
    join public.fcm_installations as installation on installation.id = outbox.installation_id
    where (
      (outbox.status = 'pending' and outbox.available_at <= now())
      or (outbox.status = 'processing' and outbox.locked_until < now())
    )
      and installation.active
      and installation.last_seen_at >= now() - interval '30 days'
      and outbox.attempt_count < 5
      and (p_allowed_fids is null or installation.fid = any (p_allowed_fids))
    order by outbox.created_at
    limit least(greatest(coalesce(p_limit, 50), 1), 50)
    for update of outbox skip locked
  ), claimed as (
    update public.push_outbox as outbox
    set status = 'processing',
        attempt_count = outbox.attempt_count + 1,
        locked_until = now() + interval '2 minutes',
        locked_by = p_worker_id,
        updated_at = now()
    from candidates
    where outbox.id = candidates.id
    returning outbox.id, outbox.installation_id, outbox.payload, outbox.attempt_count
  )
  select claimed.id, claimed.installation_id, installation.fid, claimed.payload, claimed.attempt_count
  from claimed
  join public.fcm_installations as installation on installation.id = claimed.installation_id;
end;
$$;

create or replace function public.complete_push_notification(
  p_outbox_id uuid,
  p_provider_message_id text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  update public.push_outbox
  set status = 'sent',
      provider_message_id = nullif(left(trim(p_provider_message_id), 255), ''),
      locked_until = null,
      locked_by = null,
      updated_at = now()
  where id = p_outbox_id and status = 'processing'
  returning true;
$$;

create or replace function public.fail_push_notification(
  p_outbox_id uuid,
  p_retryable boolean,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_installation_id uuid;
  v_error_code text := coalesce(nullif(left(trim(p_error_code), 120), ''), 'UNKNOWN');
begin
  update public.push_outbox
  set status = case
        when v_error_code = 'UNREGISTERED' then 'failed'
        when coalesce(p_retryable, false) and attempt_count < 5 then 'pending'
        else 'failed'
      end,
      available_at = case
        when coalesce(p_retryable, false) and attempt_count < 5 and v_error_code <> 'UNREGISTERED' then
          now() + case attempt_count
            when 1 then interval '1 minute'
            when 2 then interval '5 minutes'
            when 3 then interval '30 minutes'
            else interval '2 hours'
          end
        else available_at
      end,
      last_error_code = v_error_code,
      locked_until = null,
      locked_by = null,
      updated_at = now()
  where id = p_outbox_id and status = 'processing'
  returning installation_id into v_installation_id;

  if v_installation_id is null then return false; end if;
  if v_error_code = 'UNREGISTERED' then
    update public.fcm_installations set active = false where id = v_installation_id;
    delete from public.fcm_installation_recipients where installation_id = v_installation_id;
    update public.push_outbox
    set status = 'cancelled', last_error_code = 'UNREGISTERED', updated_at = now()
    where installation_id = v_installation_id and status = 'pending';
  end if;
  return true;
end;
$$;

revoke all on function public.claim_push_notification_batch(integer, uuid, text[]) from public, anon, authenticated;
revoke all on function public.complete_push_notification(uuid, text) from public, anon, authenticated;
revoke all on function public.fail_push_notification(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.claim_push_notification_batch(integer, uuid, text[]) to service_role;
grant execute on function public.complete_push_notification(uuid, text) to service_role;
grant execute on function public.fail_push_notification(uuid, boolean, text) to service_role;

create or replace function private.cleanup_notification_state()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.guest_notification_sessions where expires_at <= now();
  update public.fcm_installations
  set active = false, updated_at = now()
  where active and last_seen_at < now() - interval '30 days';
  delete from public.fcm_installation_recipients as recipient
  using public.fcm_installations as installation
  where recipient.installation_id = installation.id and not installation.active;
  update public.fcm_installations as installation
  set active = false, updated_at = now()
  where installation.active
    and not exists (
      select 1 from public.fcm_installation_recipients as recipient
      where recipient.installation_id = installation.id
    );
  update public.push_outbox
  set status = 'cancelled', last_error_code = 'INSTALLATION_INACTIVE', updated_at = now()
  where status = 'pending'
    and exists (
      select 1 from public.fcm_installations as installation
      where installation.id = push_outbox.installation_id and not installation.active
    );
end;
$$;

create or replace function private.invoke_fcm_dispatch()
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
  select decrypted_secret into v_job_secret from vault.decrypted_secrets where name = 'fcm_worker_secret';
  if v_project_url is null or v_job_secret is null then return null; end if;
  select net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/dispatch-fcm-notifications',
    headers := jsonb_build_object('content-type', 'application/json', 'x-fcm-worker-secret', v_job_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) into v_request_id;
  return v_request_id;
end;
$$;

revoke all on function private.cleanup_notification_state() from public, anon, authenticated, service_role;
revoke all on function private.invoke_fcm_dispatch() from public, anon, authenticated, service_role;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'beanbus-dispatch-fcm-notifications') then
    perform cron.schedule('beanbus-dispatch-fcm-notifications', '* * * * *', 'select private.invoke_fcm_dispatch()');
  end if;
  if not exists (select 1 from cron.job where jobname = 'beanbus-cleanup-notification-state') then
    perform cron.schedule('beanbus-cleanup-notification-state', '15 3 * * *', 'select private.cleanup_notification_state()');
  end if;
end;
$$;
