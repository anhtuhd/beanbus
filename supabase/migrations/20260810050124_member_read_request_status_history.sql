create policy "Members read their booking request history"
on public.booking_request_status_history for select to authenticated
using (
  exists (
    select 1
    from public.booking_requests
    where booking_requests.id = booking_request_status_history.booking_request_id
      and booking_requests.user_id = (select auth.uid())
  )
  or (select public.current_user_role()) = 'admin'
);

create policy "Members read their customer request history"
on public.customer_request_status_history for select to authenticated
using (
  exists (
    select 1
    from public.customer_requests
    where customer_requests.id = customer_request_status_history.customer_request_id
      and customer_requests.user_id = (select auth.uid())
  )
  or (select public.current_user_role()) = 'admin'
);
