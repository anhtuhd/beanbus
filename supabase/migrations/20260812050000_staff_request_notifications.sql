alter table public.notifications
  drop constraint if exists notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check
  check (kind in (
    'order_created',
    'order_status_changed',
    'event_published',
    'store_announcement',
    'booking_request_created',
    'customer_request_created'
  ));

alter table public.notifications
  drop constraint if exists notifications_source_type_check;

alter table public.notifications
  add constraint notifications_source_type_check
  check (source_type in ('order', 'event', 'store_announcement', 'booking_request', 'customer_request'));

create or replace function public.notify_new_booking_request()
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
  end loop;
  return new;
end;
$$;

create or replace function public.notify_new_customer_request()
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
  end loop;
  return new;
end;
$$;

revoke all on function public.notify_new_booking_request() from public, anon, authenticated;
revoke all on function public.notify_new_customer_request() from public, anon, authenticated;

drop trigger if exists booking_requests_create_notifications on public.booking_requests;
create trigger booking_requests_create_notifications
after insert on public.booking_requests
for each row execute function public.notify_new_booking_request();

drop trigger if exists customer_requests_create_notifications on public.customer_requests;
create trigger customer_requests_create_notifications
after insert on public.customer_requests
for each row execute function public.notify_new_customer_request();
