create table public.member_role_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  from_role public.app_role not null,
  to_role public.app_role not null,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index member_role_history_user_idx
on public.member_role_history (user_id, created_at desc);

alter table public.member_role_history enable row level security;
revoke all on table public.member_role_history from anon, authenticated;
grant select on table public.member_role_history to authenticated;
grant all on table public.member_role_history to service_role;

create policy "Admins read member role history"
on public.member_role_history
for select
to authenticated
using ((select public.current_user_role()) = 'admin');

create function public.update_member_role(
  p_user_id uuid,
  p_role public.app_role
)
returns table (
  updated_user_id uuid,
  updated_role public.app_role
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_from_role public.app_role;
begin
  if v_actor_id is null or (select public.current_user_role()) is distinct from 'admin' then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if p_user_id is null or p_role is null then raise exception 'INVALID_MEMBER_ROLE'; end if;
  if p_user_id = v_actor_id and p_role <> 'admin' then raise exception 'SELF_DEMOTION_FORBIDDEN'; end if;

  select role into v_from_role from public.profiles where id = p_user_id for update;
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
  if v_from_role = p_role then
    return query select p_user_id, p_role;
    return;
  end if;

  update public.profiles set role = p_role where id = p_user_id;
  insert into public.member_role_history (user_id, from_role, to_role, actor_user_id)
  values (p_user_id, v_from_role, p_role, v_actor_id);

  return query select p_user_id, p_role;
end;
$$;

revoke all on function public.update_member_role(uuid, public.app_role) from public;
grant execute on function public.update_member_role(uuid, public.app_role) to authenticated;
