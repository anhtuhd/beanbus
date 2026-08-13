-- Keep the admin order notification aligned with the final server-calculated price.
create or replace function public.notify_new_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Server-priced orders are inserted with zero totals and priced immediately after.
  if tg_op = 'INSERT'
    and new.subtotal_vnd = 0
    and new.discount_vnd = 0
    and new.total_vnd = 0 then
    return new;
  end if;

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

revoke all on function public.notify_new_order() from public, anon, authenticated;

-- Guest users need an initial notification because the order is already pending
-- when the signed receipt is linked. Later status/payment changes use the
-- existing orders_status_create_notifications trigger.
alter table public.guest_notifications
  drop constraint if exists guest_notifications_kind_check;

alter table public.guest_notifications
  add constraint guest_notifications_kind_check
  check (kind in ('order_created', 'order_status_changed', 'order_payment_changed'));

create or replace function public.notify_guest_order_linked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.guest_notifications (
    guest_session_id, kind, title_vi, title_en, body_vi, body_en,
    href, order_id, dedupe_key
  )
  select
    new.guest_session_id,
    'order_created',
    'Đơn hàng đã tiếp nhận',
    'Order received',
    format('Đơn %s đã được tiếp nhận, tổng %sđ.', orders.order_code, to_char(orders.total_vnd, 'FM999G999G999')),
    format('Order %s was received, total %s VND.', orders.order_code, to_char(orders.total_vnd, 'FM999G999G999')),
    '/order/guest/' || orders.id::text,
    orders.id,
    'guest_order_created:' || orders.id::text
  from public.orders
  where orders.id = new.order_id
  on conflict (guest_session_id, dedupe_key) do nothing;

  return new;
end;
$$;

revoke all on function public.notify_guest_order_linked() from public, anon, authenticated;

drop trigger if exists guest_order_access_create_notification on public.guest_order_access;
create trigger guest_order_access_create_notification
after insert on public.guest_order_access
for each row execute function public.notify_guest_order_linked();
