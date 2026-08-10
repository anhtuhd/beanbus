create policy "Members read their order status history"
on public.order_status_history for select to authenticated
using (
  exists (
    select 1
    from public.orders
    where orders.id = order_status_history.order_id
      and orders.user_id = (select auth.uid())
  )
  or (select public.current_user_role()) = 'admin'
);
