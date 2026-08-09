create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status not null,
  to_status public.order_status not null,
  actor_user_id uuid references auth.users (id) on delete restrict,
  actor_type text not null check (actor_type in ('admin', 'system')),
  created_at timestamptz not null default now(),
  check ((actor_type = 'admin' and actor_user_id is not null) or actor_type = 'system')
);

create index order_status_history_order_idx
on public.order_status_history (order_id, created_at desc);

alter table public.order_status_history enable row level security;
revoke all on table public.order_status_history from anon, authenticated;
grant select on table public.order_status_history to authenticated;
grant all on table public.order_status_history to service_role;

create policy "Admins read order status history"
on public.order_status_history for select to authenticated
using ((select public.current_user_role()) = 'admin');

revoke update (status, payment_status, updated_at) on table public.orders from authenticated;

create function public.audit_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_actor_type text;
begin
  if old.status is distinct from new.status then
    v_actor_type := case
      when v_actor_id is not null and (select public.current_user_role()) = 'admin' then 'admin'
      else 'system'
    end;

    insert into public.order_status_history (
      order_id, from_status, to_status, actor_user_id, actor_type
    ) values (
      new.id, old.status, new.status,
      case when v_actor_type = 'admin' then v_actor_id end,
      v_actor_type
    );
  end if;
  return new;
end;
$$;

create trigger orders_audit_status_change
after update of status on public.orders
for each row execute function public.audit_order_status_change();

create function public.update_order_status(
  p_order_id uuid,
  p_status public.order_status
)
returns table (
  updated_order_id uuid,
  updated_order_status public.order_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_transition text;
begin
  if (select public.current_user_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_order_id is null or p_status is null then raise exception 'INVALID_ORDER_STATUS'; end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  if v_order.status = p_status then
    return query select v_order.id, v_order.status;
    return;
  end if;

  if v_order.payment_method = 'sepay_qr'
    and v_order.payment_status <> 'paid'
    and v_order.status = 'pending'
    and p_status = 'confirmed' then
    raise exception 'PAYMENT_REQUIRED';
  end if;
  if v_order.payment_status = 'paid' and p_status = 'cancelled' then
    raise exception 'REFUND_REQUIRED';
  end if;

  v_transition := v_order.status::text || ':' || p_status::text;
  if v_transition not in (
    'pending:confirmed',
    'pending:cancelled',
    'confirmed:preparing',
    'confirmed:cancelled',
    'preparing:ready',
    'preparing:cancelled',
    'ready:completed',
    'ready:cancelled'
  ) then raise exception 'INVALID_ORDER_TRANSITION'; end if;

  update public.orders set status = p_status where id = v_order.id;
  return query select v_order.id, p_status;
end;
$$;

revoke all on function public.audit_order_status_change() from public;
revoke all on function public.update_order_status(uuid, public.order_status) from public;
grant execute on function public.update_order_status(uuid, public.order_status) to authenticated;
