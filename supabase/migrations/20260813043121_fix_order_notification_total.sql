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

  if tg_op = 'UPDATE'
    and new.subtotal_vnd is not distinct from old.subtotal_vnd
    and new.discount_vnd is not distinct from old.discount_vnd
    and new.total_vnd is not distinct from old.total_vnd then
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

drop trigger if exists orders_create_notifications on public.orders;
create trigger orders_create_notifications
after insert or update of subtotal_vnd, discount_vnd, total_vnd on public.orders
for each row execute function public.notify_new_order();
