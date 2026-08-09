create table public.customer_requests (
  id uuid primary key default gen_random_uuid(),
  reference_number bigint generated always as identity unique,
  idempotency_key uuid not null unique,
  user_id uuid references auth.users (id) on delete set null,
  request_type text not null check (request_type in ('contact', 'rsvp', 'b2b_quote')),
  contact_name text not null check (char_length(contact_name) between 2 and 100),
  contact_phone text not null check (contact_phone ~ '^\+84[35789][0-9]{8}$'),
  contact_email text check (
    contact_email is null
    or (char_length(contact_email) <= 254 and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  ),
  subject_reference text check (subject_reference is null or char_length(subject_reference) <= 100),
  organization text check (organization is null or char_length(organization) between 2 and 150),
  volume_range text check (volume_range is null or volume_range in ('10_30', '30_100', 'over_100')),
  message text check (message is null or char_length(message) between 10 and 2000),
  consent_to_contact boolean not null check (consent_to_contact),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'resolved', 'rejected')),
  notification_status text not null default 'not_configured' check (notification_status in ('not_configured', 'pending', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_requests_type_fields check (
    (
      request_type = 'contact'
      and message is not null
      and subject_reference is null
      and organization is null
      and volume_range is null
    )
    or (
      request_type = 'rsvp'
      and subject_reference ~ '^event-[a-z0-9][a-z0-9-]{0,92}$'
      and message is null
      and organization is null
      and volume_range is null
    )
    or (
      request_type = 'b2b_quote'
      and (subject_reference is null or subject_reference ~ '^bean-[a-z0-9][a-z0-9-]{0,93}$')
      and volume_range is not null
      and message is null
    )
  )
);

create index customer_requests_contact_created_idx
on public.customer_requests (request_type, contact_phone, created_at desc);
create index customer_requests_status_created_idx
on public.customer_requests (status, created_at desc);

alter table public.customer_requests enable row level security;
revoke all on table public.customer_requests from anon, authenticated;
grant select on table public.customer_requests to authenticated;
grant update (status, notification_status, updated_at) on table public.customer_requests to authenticated;
grant all on table public.customer_requests to service_role;

create policy "Members read their customer requests"
on public.customer_requests for select to authenticated
using ((select auth.uid()) = user_id or (select public.current_user_role()) = 'admin');

create policy "Admins update customer requests"
on public.customer_requests for update to authenticated
using ((select public.current_user_role()) = 'admin')
with check ((select public.current_user_role()) = 'admin');

create trigger customer_requests_set_updated_at before update on public.customer_requests
for each row execute function public.set_updated_at();

create function public.create_customer_request(
  p_idempotency_key uuid,
  p_request_type text,
  p_contact_name text,
  p_contact_phone text,
  p_contact_email text,
  p_subject_reference text,
  p_organization text,
  p_volume_range text,
  p_message text,
  p_consent_to_contact boolean
)
returns table (
  request_id uuid,
  request_number bigint,
  created_request_type text,
  request_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.customer_requests%rowtype;
begin
  if p_idempotency_key is null then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

  select * into v_request from public.customer_requests where idempotency_key = p_idempotency_key;
  if found then
    if v_request.user_id is distinct from (select auth.uid()) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return query select v_request.id, v_request.reference_number, v_request.request_type, v_request.status;
    return;
  end if;

  if p_request_type is null or p_request_type not in ('contact', 'rsvp', 'b2b_quote') then
    raise exception 'INVALID_REQUEST_TYPE';
  end if;
  if p_contact_name is null
    or char_length(trim(p_contact_name)) not between 2 and 100
    or p_contact_phone is null
    or p_contact_phone !~ '^\+84[35789][0-9]{8}$' then
    raise exception 'INVALID_CONTACT';
  end if;
  if p_contact_email is not null and (
    char_length(trim(p_contact_email)) > 254
    or lower(trim(p_contact_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) then raise exception 'INVALID_EMAIL'; end if;
  if p_consent_to_contact is not true then raise exception 'CONSENT_REQUIRED'; end if;

  if p_request_type = 'contact' then
    if p_message is null or char_length(trim(p_message)) not between 10 and 2000 then raise exception 'INVALID_MESSAGE'; end if;
    if p_subject_reference is not null or p_organization is not null or p_volume_range is not null then raise exception 'INVALID_REQUEST_FIELDS'; end if;
  elsif p_request_type = 'rsvp' then
    if p_subject_reference is null or p_subject_reference !~ '^event-[a-z0-9][a-z0-9-]{0,92}$' then raise exception 'INVALID_EVENT'; end if;
    if p_message is not null or p_organization is not null or p_volume_range is not null then raise exception 'INVALID_REQUEST_FIELDS'; end if;
  else
    if p_subject_reference is not null and p_subject_reference !~ '^bean-[a-z0-9][a-z0-9-]{0,93}$' then raise exception 'INVALID_BEAN'; end if;
    if p_organization is not null and char_length(trim(p_organization)) not between 2 and 150 then raise exception 'INVALID_ORGANIZATION'; end if;
    if p_volume_range is null or p_volume_range not in ('10_30', '30_100', 'over_100') then raise exception 'INVALID_VOLUME_RANGE'; end if;
    if p_message is not null then raise exception 'INVALID_REQUEST_FIELDS'; end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_type || ':' || p_contact_phone, 0));
  if (select count(*) from public.customer_requests
      where request_type = p_request_type
        and contact_phone = p_contact_phone
        and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'RATE_LIMITED';
  end if;

  insert into public.customer_requests (
    idempotency_key, user_id, request_type, contact_name, contact_phone, contact_email,
    subject_reference, organization, volume_range, message, consent_to_contact
  ) values (
    p_idempotency_key, (select auth.uid()), p_request_type, trim(p_contact_name), p_contact_phone,
    nullif(lower(trim(p_contact_email)), ''), nullif(trim(p_subject_reference), ''),
    nullif(trim(p_organization), ''), p_volume_range, nullif(trim(p_message), ''), true
  ) returning * into v_request;

  return query select v_request.id, v_request.reference_number, v_request.request_type, v_request.status;
end;
$$;

revoke all on function public.create_customer_request(uuid, text, text, text, text, text, text, text, text, boolean) from public;
grant execute on function public.create_customer_request(uuid, text, text, text, text, text, text, text, text, boolean) to anon, authenticated;
