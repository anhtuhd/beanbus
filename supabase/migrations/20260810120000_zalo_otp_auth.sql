create extension if not exists supabase_vault with schema vault;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;
revoke all on schema vault from public, anon, authenticated, service_role;
revoke all on table vault.secrets from public, anon, authenticated, service_role;
revoke all on table vault.decrypted_secrets from public, anon, authenticated, service_role;

revoke update (phone) on public.profiles from authenticated;
grant update (full_name, birthday, avatar_url) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    case when new.phone_confirmed_at is null then null else new.phone end,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

create function private.sync_verified_phone_to_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set phone = case when new.phone_confirmed_at is null then null else new.phone end
  where id = new.id;

  return new;
end;
$$;

revoke all on function private.sync_verified_phone_to_profile() from public;

create trigger on_auth_user_phone_verified
after update of phone, phone_confirmed_at on auth.users
for each row execute function private.sync_verified_phone_to_profile();

update public.profiles as profile
set phone = case when auth_user.phone_confirmed_at is null then null else auth_user.phone end
from auth.users as auth_user
where profile.id = auth_user.id
  and profile.phone is distinct from case
    when auth_user.phone_confirmed_at is null then null
    else auth_user.phone
  end;

create table private.zalo_oauth_state (
  singleton boolean primary key default true check (singleton),
  access_token_secret_id uuid not null,
  refresh_token_secret_id uuid not null,
  access_token_expires_at timestamptz not null,
  version bigint not null default 1 check (version > 0),
  lease_id uuid,
  lease_expires_at timestamptz,
  updated_at timestamptz not null default now(),
  check ((lease_id is null) = (lease_expires_at is null))
);

revoke all on table private.zalo_oauth_state from public, anon, authenticated;

create function public.initialize_zalo_oauth_state(p_expires_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_access_secret_id uuid;
  v_refresh_secret_id uuid;
begin
  if p_expires_at is null or p_expires_at <= now() + interval '1 minute' then
    raise exception 'Invalid Zalo OAuth token configuration';
  end if;

  select id into v_access_secret_id
  from vault.secrets
  where name = 'zalo_oa_access_token';

  select id into v_refresh_secret_id
  from vault.secrets
  where name = 'zalo_oa_refresh_token';

  if v_access_secret_id is null or v_refresh_secret_id is null then
    raise exception 'Create both named Zalo OAuth secrets in Vault before initialization';
  end if;

  insert into private.zalo_oauth_state (
    singleton,
    access_token_secret_id,
    refresh_token_secret_id,
    access_token_expires_at,
    version,
    lease_id,
    lease_expires_at,
    updated_at
  )
  values (
    true,
    v_access_secret_id,
    v_refresh_secret_id,
    p_expires_at,
    1,
    null,
    null,
    now()
  )
  on conflict (singleton) do update
  set access_token_secret_id = excluded.access_token_secret_id,
      refresh_token_secret_id = excluded.refresh_token_secret_id,
      access_token_expires_at = excluded.access_token_expires_at,
      version = private.zalo_oauth_state.version + 1,
      lease_id = null,
      lease_expires_at = null,
      updated_at = now();
end;
$$;

create function public.get_zalo_access_token()
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select secret.decrypted_secret
  from private.zalo_oauth_state as state
  join vault.decrypted_secrets as secret
    on secret.id = state.access_token_secret_id
  where state.singleton
    and state.access_token_expires_at > now() + interval '2 minutes'
$$;

create function public.claim_zalo_token_refresh()
returns table (lease_id uuid, refresh_token text, version bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lease_id uuid := gen_random_uuid();
  v_refresh_secret_id uuid;
  v_version bigint;
begin
  update private.zalo_oauth_state as state
  set lease_id = v_lease_id,
      lease_expires_at = now() + interval '5 minutes',
      updated_at = now()
  where state.singleton
    and state.access_token_expires_at <= now() + interval '14 hours'
    and (state.lease_id is null or state.lease_expires_at <= now())
  returning state.refresh_token_secret_id, state.version
  into v_refresh_secret_id, v_version;

  if not found then
    return;
  end if;

  return query
  select v_lease_id, secret.decrypted_secret, v_version
  from vault.decrypted_secrets as secret
  where secret.id = v_refresh_secret_id;
end;
$$;

create function public.complete_zalo_token_refresh(
  p_lease_id uuid,
  p_expected_version bigint,
  p_access_token text,
  p_refresh_token text,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_access_secret_id uuid;
  v_refresh_secret_id uuid;
begin
  if length(coalesce(p_access_token, '')) < 20
    or length(coalesce(p_refresh_token, '')) < 20
    or p_expires_at is null
    or p_expires_at <= now() + interval '1 minute'
  then
    return false;
  end if;

  select state.access_token_secret_id, state.refresh_token_secret_id
  into v_access_secret_id, v_refresh_secret_id
  from private.zalo_oauth_state as state
  where state.singleton
    and state.lease_id = p_lease_id
    and state.version = p_expected_version
    and state.lease_expires_at > now()
  for update;

  if not found then
    return false;
  end if;

  perform vault.update_secret(v_access_secret_id, p_access_token);
  perform vault.update_secret(v_refresh_secret_id, p_refresh_token);

  update private.zalo_oauth_state
  set access_token_expires_at = p_expires_at,
      version = version + 1,
      lease_id = null,
      lease_expires_at = null,
      updated_at = now()
  where singleton;

  return true;
end;
$$;

create function public.release_zalo_token_refresh(p_lease_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.zalo_oauth_state
  set lease_id = null,
      lease_expires_at = null,
      updated_at = now()
  where singleton
    and lease_id = p_lease_id;

  return found;
end;
$$;

revoke all on function public.initialize_zalo_oauth_state(timestamptz) from public, anon, authenticated;
revoke all on function public.get_zalo_access_token() from public, anon, authenticated;
revoke all on function public.claim_zalo_token_refresh() from public, anon, authenticated;
revoke all on function public.complete_zalo_token_refresh(uuid, bigint, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.release_zalo_token_refresh(uuid) from public, anon, authenticated;

grant execute on function public.initialize_zalo_oauth_state(timestamptz) to service_role;
grant execute on function public.get_zalo_access_token() to service_role;
grant execute on function public.claim_zalo_token_refresh() to service_role;
grant execute on function public.complete_zalo_token_refresh(uuid, bigint, text, text, timestamptz) to service_role;
grant execute on function public.release_zalo_token_refresh(uuid) to service_role;

create function private.clear_stale_phone_changes()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count bigint;
begin
  update auth.users
  set phone_change = '',
      phone_change_token = '',
      phone_change_sent_at = null,
      updated_at = now()
  where phone_change_sent_at < now() - interval '15 minutes'
    and phone_change <> '';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function private.invoke_zalo_token_refresh()
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
  select decrypted_secret into v_project_url
  from vault.decrypted_secrets
  where name = 'project_url';

  select decrypted_secret into v_job_secret
  from vault.decrypted_secrets
  where name = 'zalo_refresh_job_secret';

  if v_project_url is null or v_job_secret is null then
    return null;
  end if;

  select net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/refresh-zalo-token',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-zalo-refresh-secret', v_job_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function private.clear_stale_phone_changes() from public, anon, authenticated;
revoke all on function private.invoke_zalo_token_refresh() from public, anon, authenticated;

select cron.schedule(
  'beanbus-clear-stale-phone-changes',
  '*/15 * * * *',
  'select private.clear_stale_phone_changes()'
);

select cron.schedule(
  'beanbus-refresh-zalo-token',
  '17 */12 * * *',
  'select private.invoke_zalo_token_refresh()'
);
