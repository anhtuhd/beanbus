create table public.catalog_menus (
  id text primary key,
  slug text not null unique,
  name_vi text not null,
  name_en text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.catalog_menu_schedules (
  id bigint generated always as identity primary key,
  menu_id text not null references public.catalog_menus (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  check (starts_at < ends_at),
  unique (menu_id, day_of_week, starts_at, ends_at)
);

create table public.catalog_menu_sections (
  id text primary key,
  menu_id text not null references public.catalog_menus (id) on delete cascade,
  category_id text not null references public.catalog_categories (id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0),
  unique (menu_id, category_id)
);

create table public.catalog_menu_items (
  section_id text not null references public.catalog_menu_sections (id) on delete cascade,
  product_id text not null references public.products (id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_visible boolean not null default true,
  primary key (section_id, product_id)
);

create index catalog_menu_schedules_lookup_idx
on public.catalog_menu_schedules (menu_id, day_of_week, starts_at, ends_at);

create index catalog_menu_sections_menu_sort_idx
on public.catalog_menu_sections (menu_id, sort_order);

create index catalog_menu_items_product_idx
on public.catalog_menu_items (product_id, section_id)
where is_visible;

alter table public.catalog_option_sets
  add column if not exists name_vi text,
  add column if not exists name_en text;

update public.catalog_option_sets
set name_vi = coalesce(name_vi, name), name_en = coalesce(name_en, name)
where name_vi is null or name_en is null;

alter table public.catalog_option_sets
  alter column name_vi set default '',
  alter column name_en set default '';

alter table public.catalog_options
  add column if not exists is_default boolean not null default false;

create table public.catalog_option_groups (
  id text primary key,
  option_set_id text not null references public.catalog_option_sets (id) on delete cascade,
  group_name text not null check (group_name in ('size', 'sugar', 'ice', 'topping')),
  name_vi text not null,
  name_en text not null,
  is_required boolean not null default false,
  min_selections smallint not null default 0 check (min_selections >= 0),
  max_selections smallint not null default 1 check (max_selections >= min_selections),
  allow_multiple boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (option_set_id, group_name)
);

create index catalog_option_groups_set_sort_idx
on public.catalog_option_groups (option_set_id, sort_order)
where is_active;

insert into public.catalog_option_groups (id, option_set_id, group_name, name_vi, name_en, is_required, min_selections, max_selections, allow_multiple, sort_order)
values
  ('standard-drink-size', 'standard-drink', 'size', 'Kích cỡ', 'Size', true, 1, 1, false, 10),
  ('standard-drink-sugar', 'standard-drink', 'sugar', 'Lượng đường', 'Sugar level', false, 0, 1, false, 20),
  ('standard-drink-ice', 'standard-drink', 'ice', 'Lượng đá', 'Ice level', false, 0, 1, false, 30),
  ('standard-drink-topping', 'standard-drink', 'topping', 'Topping', 'Toppings', false, 0, 5, true, 40)
on conflict (option_set_id, group_name) do nothing;

create table public.catalog_releases (
  id uuid primary key default gen_random_uuid(),
  version bigint not null unique,
  status text not null check (status in ('draft', 'published', 'archived')),
  snapshot jsonb not null,
  lock_version bigint not null default 1 check (lock_version > 0),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  published_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create unique index catalog_releases_one_draft_idx
on public.catalog_releases (status) where status = 'draft';

create unique index catalog_releases_one_published_idx
on public.catalog_releases (status) where status = 'published';

create table public.catalog_publication_history (
  id bigint generated always as identity primary key,
  release_id uuid not null references public.catalog_releases (id) on delete restrict,
  version bigint not null,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index catalog_publication_history_created_idx
on public.catalog_publication_history (created_at desc);

alter table public.catalog_menus enable row level security;
alter table public.catalog_menu_schedules enable row level security;
alter table public.catalog_menu_sections enable row level security;
alter table public.catalog_menu_items enable row level security;
alter table public.catalog_option_groups enable row level security;
alter table public.catalog_releases enable row level security;
alter table public.catalog_publication_history enable row level security;

revoke all on table public.catalog_menus, public.catalog_menu_schedules, public.catalog_menu_sections,
  public.catalog_menu_items, public.catalog_option_groups, public.catalog_releases,
  public.catalog_publication_history from anon, authenticated;
grant select on table public.catalog_menus, public.catalog_menu_schedules, public.catalog_menu_sections,
  public.catalog_menu_items, public.catalog_option_groups to anon, authenticated;
grant select on table public.catalog_releases, public.catalog_publication_history to authenticated;
grant all on table public.catalog_menus, public.catalog_menu_schedules, public.catalog_menu_sections,
  public.catalog_menu_items, public.catalog_option_groups, public.catalog_releases,
  public.catalog_publication_history to service_role;

create policy "Public can read active catalog menus"
on public.catalog_menus for select to anon, authenticated
using (is_active);

create policy "Public can read active catalog menu schedules"
on public.catalog_menu_schedules for select to anon, authenticated
using (exists (select 1 from public.catalog_menus m where m.id = menu_id and m.is_active));

create policy "Public can read active catalog menu sections"
on public.catalog_menu_sections for select to anon, authenticated
using (exists (select 1 from public.catalog_menus m where m.id = menu_id and m.is_active));

create policy "Public can read visible catalog menu items"
on public.catalog_menu_items for select to anon, authenticated
using (is_visible and exists (
  select 1 from public.catalog_menu_sections s
  join public.catalog_menus m on m.id = s.menu_id
  where s.id = section_id and m.is_active
));

create policy "Public can read active option groups"
on public.catalog_option_groups for select to anon, authenticated
using (is_active and exists (
  select 1 from public.catalog_option_sets s
  where s.id = option_set_id and s.is_active
));

create policy "Admins read catalog releases"
on public.catalog_releases for select to authenticated
using ((select public.current_user_role()) = 'admin');

create policy "Admins read catalog publication history"
on public.catalog_publication_history for select to authenticated
using ((select public.current_user_role()) = 'admin');

create trigger catalog_menus_set_updated_at
before update on public.catalog_menus for each row execute function public.set_updated_at();

create trigger catalog_option_groups_set_updated_at
before update on public.catalog_option_groups for each row execute function public.set_updated_at();

insert into public.catalog_menus (id, slug, name_vi, name_en, sort_order)
values ('all-day', 'all-day', 'Beanbus Cả ngày', 'Beanbus All Day', 10)
on conflict (id) do nothing;

insert into public.catalog_menu_schedules (menu_id, day_of_week, starts_at, ends_at)
select 'all-day', day, '07:00'::time, '23:00'::time
from generate_series(0, 6) as days(day)
on conflict (menu_id, day_of_week, starts_at, ends_at) do nothing;

insert into public.catalog_menu_sections (id, menu_id, category_id, sort_order)
select 'all-day-' || c.id, 'all-day', c.id, c.sort_order
from public.catalog_categories c
where c.is_active
on conflict (id) do nothing;

insert into public.catalog_menu_items (section_id, product_id, sort_order, is_visible)
select 'all-day-' || p.category_id, p.id, p.sort_order, p.is_published
from public.products p
where p.is_published
on conflict (section_id, product_id) do nothing;

insert into public.catalog_releases (version, status, snapshot, published_at)
select 1, 'published', jsonb_build_object(
  'schemaVersion', 1,
  'categories', coalesce((select jsonb_agg(jsonb_build_object(
    'id', c.id, 'nameVi', c.name_vi, 'nameEn', c.name_en, 'sortOrder', c.sort_order, 'isActive', c.is_active
  ) order by c.sort_order) from public.catalog_categories c), '[]'::jsonb),
  'optionSets', coalesce((select jsonb_agg(jsonb_build_object(
    'id', s.id, 'name', s.name, 'nameVi', coalesce(s.name_vi, s.name), 'nameEn', coalesce(s.name_en, s.name), 'isActive', s.is_active,
    'groups', coalesce((select jsonb_agg(jsonb_build_object(
      'id', g.id, 'groupName', g.group_name, 'nameVi', g.name_vi, 'nameEn', g.name_en,
      'isRequired', g.is_required, 'minSelections', g.min_selections, 'maxSelections', g.max_selections,
      'allowMultiple', g.allow_multiple, 'sortOrder', g.sort_order, 'isActive', g.is_active,
      'options', coalesce((select jsonb_agg(jsonb_build_object(
        'id', o.id, 'groupName', o.group_name, 'nameVi', o.name_vi, 'nameEn', o.name_en,
        'extraPriceVnd', o.extra_price_vnd, 'sortOrder', o.sort_order, 'isActive', o.is_active, 'isDefault', o.is_default
      ) order by o.sort_order) from public.catalog_options o where o.option_set_id = s.id and o.group_name = g.group_name), '[]'::jsonb)
    ) order by g.sort_order) from public.catalog_option_groups g where g.option_set_id = s.id), '[]'::jsonb)
  ) order by s.created_at) from public.catalog_option_sets s), '[]'::jsonb),
  'products', coalesce((select jsonb_agg(jsonb_build_object(
    'id', p.id, 'categoryId', p.category_id, 'optionSetId', p.option_set_id,
    'nameVi', p.name_vi, 'nameEn', p.name_en, 'descriptionVi', p.description_vi, 'descriptionEn', p.description_en,
    'priceVnd', p.price_vnd, 'imageUrl', p.image_url, 'badge', p.badge, 'tastingNotes', p.tasting_notes,
    'isAvailable', p.is_available, 'isPublished', p.is_published, 'sortOrder', p.sort_order
  ) order by p.sort_order) from public.products p), '[]'::jsonb),
  'menus', coalesce((select jsonb_agg(jsonb_build_object(
    'id', m.id, 'slug', m.slug, 'nameVi', m.name_vi, 'nameEn', m.name_en, 'sortOrder', m.sort_order, 'isActive', m.is_active,
    'schedules', coalesce((select jsonb_agg(jsonb_build_object(
      'dayOfWeek', s.day_of_week, 'startsAt', to_char(s.starts_at, 'HH24:MI'), 'endsAt', to_char(s.ends_at, 'HH24:MI')
    ) order by s.day_of_week, s.starts_at) from public.catalog_menu_schedules s where s.menu_id = m.id), '[]'::jsonb),
    'sections', coalesce((select jsonb_agg(jsonb_build_object(
      'id', sec.id, 'categoryId', sec.category_id, 'sortOrder', sec.sort_order,
      'productIds', coalesce((select jsonb_agg(i.product_id order by i.sort_order) from public.catalog_menu_items i where i.section_id = sec.id and i.is_visible), '[]'::jsonb)
    ) order by sec.sort_order) from public.catalog_menu_sections sec where sec.menu_id = m.id), '[]'::jsonb)
  ) order by m.sort_order) from public.catalog_menus m), '[]'::jsonb)), now();

insert into public.catalog_releases (version, status, snapshot, published_at)
select 2, 'draft', snapshot, null
from public.catalog_releases
where version = 1;

create or replace function public.save_catalog_draft(
  p_snapshot jsonb,
  p_expected_lock_version bigint
)
returns table (release_id uuid, lock_version bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_release public.catalog_releases%rowtype;
begin
  if (select public.current_user_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object'
    or p_snapshot ->> 'schemaVersion' <> '1'
    or jsonb_typeof(p_snapshot -> 'categories') <> 'array'
    or jsonb_typeof(p_snapshot -> 'products') <> 'array'
    or jsonb_typeof(p_snapshot -> 'menus') <> 'array'
    or pg_column_size(p_snapshot) > 2 * 1024 * 1024 then
    raise exception 'INVALID_CATALOG_SNAPSHOT';
  end if;

  select * into v_release from public.catalog_releases
  where status = 'draft' for update;
  if not found then raise exception 'CATALOG_DRAFT_NOT_FOUND'; end if;
  if v_release.lock_version is distinct from p_expected_lock_version then raise exception 'CATALOG_VERSION_CONFLICT'; end if;

  update public.catalog_releases
  set snapshot = p_snapshot, lock_version = public.catalog_releases.lock_version + 1, updated_by = (select auth.uid()), updated_at = now()
  where id = v_release.id
  returning id, catalog_releases.lock_version into release_id, lock_version;
  return next;
end;
$$;

create or replace function public.publish_catalog_draft(p_expected_lock_version bigint)
returns table (published_version bigint, draft_lock_version bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.catalog_releases%rowtype;
  v_category record;
  v_option_set record;
  v_group record;
  v_option record;
  v_product record;
  v_menu record;
  v_schedule jsonb;
  v_day smallint;
  v_start time;
  v_end time;
  v_section record;
  v_product_id text;
begin
  if (select public.current_user_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v_draft from public.catalog_releases where status = 'draft' for update;
  if not found then raise exception 'CATALOG_DRAFT_NOT_FOUND'; end if;
  if v_draft.lock_version is distinct from p_expected_lock_version then raise exception 'CATALOG_VERSION_CONFLICT'; end if;
  if jsonb_typeof(v_draft.snapshot -> 'optionSets') <> 'array' then raise exception 'INVALID_CATALOG_SNAPSHOT'; end if;

  for v_menu in select * from jsonb_to_recordset(v_draft.snapshot -> 'menus') as m(id text, schedules jsonb)
  loop
    for v_schedule in select value from jsonb_array_elements(coalesce(v_menu.schedules, '[]'::jsonb))
    loop
      v_day := (v_schedule ->> 'dayOfWeek')::smallint;
      v_start := (v_schedule ->> 'startsAt')::time;
      v_end := (v_schedule ->> 'endsAt')::time;
      if v_day not between 0 and 6 or v_start >= v_end then raise exception 'INVALID_MENU_SCHEDULE'; end if;
      if exists (
        select 1
        from jsonb_array_elements(coalesce(v_menu.schedules, '[]'::jsonb)) as other(value)
        where other.value <> v_schedule
          and (other.value ->> 'dayOfWeek')::smallint = v_day
          and (other.value ->> 'startsAt')::time < v_end
          and (other.value ->> 'endsAt')::time > v_start
      ) then
        raise exception 'MENU_SCHEDULE_OVERLAP';
      end if;
    end loop;
  end loop;

  update public.catalog_categories set is_active = false
  where not exists (select 1 from jsonb_to_recordset(v_draft.snapshot -> 'categories') as c(id text) where c.id = catalog_categories.id);
  for v_category in select * from jsonb_to_recordset(v_draft.snapshot -> 'categories') as c(id text, nameVi text, nameEn text, sortOrder integer, isActive boolean)
  loop
    if v_category.id is null or v_category.nameVi is null or v_category.nameEn is null then raise exception 'INVALID_CATALOG_CATEGORY'; end if;
    insert into public.catalog_categories (id, name_vi, name_en, sort_order, is_active)
    values (v_category.id, v_category.nameVi, v_category.nameEn, coalesce(v_category.sortOrder, 0), coalesce(v_category.isActive, true))
    on conflict (id) do update set name_vi = excluded.name_vi, name_en = excluded.name_en, sort_order = excluded.sort_order, is_active = excluded.is_active;
  end loop;

  update public.catalog_option_sets set is_active = false
  where not exists (select 1 from jsonb_to_recordset(v_draft.snapshot -> 'optionSets') as s(id text) where s.id = catalog_option_sets.id);
  for v_option_set in select * from jsonb_to_recordset(v_draft.snapshot -> 'optionSets') as s(id text, name text, nameVi text, nameEn text, isActive boolean, groups jsonb)
  loop
    insert into public.catalog_option_sets (id, name, name_vi, name_en, is_active)
    values (v_option_set.id, coalesce(v_option_set.name, v_option_set.nameVi), coalesce(v_option_set.nameVi, v_option_set.name), coalesce(v_option_set.nameEn, v_option_set.name), coalesce(v_option_set.isActive, true))
    on conflict (id) do update set name = excluded.name, name_vi = excluded.name_vi, name_en = excluded.name_en, is_active = excluded.is_active;
    update public.catalog_option_groups set is_active = false where option_set_id = v_option_set.id;
    update public.catalog_options set is_active = false where option_set_id = v_option_set.id;
    for v_group in select * from jsonb_to_recordset(coalesce(v_option_set.groups, '[]'::jsonb)) as g(id text, groupName text, nameVi text, nameEn text, isRequired boolean, minSelections smallint, maxSelections smallint, allowMultiple boolean, sortOrder integer, isActive boolean, options jsonb)
    loop
      insert into public.catalog_option_groups (id, option_set_id, group_name, name_vi, name_en, is_required, min_selections, max_selections, allow_multiple, sort_order, is_active)
      values (v_group.id, v_option_set.id, v_group.groupName, v_group.nameVi, v_group.nameEn, coalesce(v_group.isRequired, false), coalesce(v_group.minSelections, 0), coalesce(v_group.maxSelections, 1), coalesce(v_group.allowMultiple, false), coalesce(v_group.sortOrder, 0), coalesce(v_group.isActive, true))
      on conflict (id) do update set name_vi = excluded.name_vi, name_en = excluded.name_en, is_required = excluded.is_required, min_selections = excluded.min_selections, max_selections = excluded.max_selections, allow_multiple = excluded.allow_multiple, sort_order = excluded.sort_order, is_active = excluded.is_active;
      for v_option in select * from jsonb_to_recordset(coalesce(v_group.options, '[]'::jsonb)) as o(id text, groupName text, nameVi text, nameEn text, extraPriceVnd integer, sortOrder integer, isActive boolean, isDefault boolean)
      loop
        insert into public.catalog_options (id, option_set_id, group_name, name_vi, name_en, extra_price_vnd, sort_order, is_active, is_default)
        values (v_option.id, v_option_set.id, v_option.groupName, v_option.nameVi, v_option.nameEn, coalesce(v_option.extraPriceVnd, 0), coalesce(v_option.sortOrder, 0), coalesce(v_option.isActive, true), coalesce(v_option.isDefault, false))
        on conflict (id) do update set option_set_id = excluded.option_set_id, group_name = excluded.group_name, name_vi = excluded.name_vi, name_en = excluded.name_en, extra_price_vnd = excluded.extra_price_vnd, sort_order = excluded.sort_order, is_active = excluded.is_active, is_default = excluded.is_default;
      end loop;
    end loop;
  end loop;

  update public.products set is_published = false
  where not exists (select 1 from jsonb_to_recordset(v_draft.snapshot -> 'products') as p(id text) where p.id = products.id);
  for v_product in select * from jsonb_to_recordset(v_draft.snapshot -> 'products') as p(id text, categoryId text, optionSetId text, nameVi text, nameEn text, descriptionVi text, descriptionEn text, priceVnd integer, imageUrl text, badge text, tastingNotes text, isAvailable boolean, isPublished boolean, sortOrder integer)
  loop
    if v_product.id is null or v_product.categoryId is null or v_product.nameVi is null or v_product.nameEn is null or v_product.priceVnd is null or v_product.imageUrl is null then raise exception 'INVALID_CATALOG_PRODUCT'; end if;
    insert into public.products (id, category_id, option_set_id, name_vi, name_en, description_vi, description_en, price_vnd, image_url, badge, tasting_notes, is_available, is_published, sort_order)
    values (v_product.id, v_product.categoryId, v_product.optionSetId, v_product.nameVi, v_product.nameEn, coalesce(v_product.descriptionVi, ''), coalesce(v_product.descriptionEn, ''), v_product.priceVnd, v_product.imageUrl, v_product.badge, v_product.tastingNotes, coalesce(v_product.isAvailable, true), coalesce(v_product.isPublished, false), coalesce(v_product.sortOrder, 0))
    on conflict (id) do update set category_id = excluded.category_id, option_set_id = excluded.option_set_id, name_vi = excluded.name_vi, name_en = excluded.name_en, description_vi = excluded.description_vi, description_en = excluded.description_en, price_vnd = excluded.price_vnd, image_url = excluded.image_url, badge = excluded.badge, tasting_notes = excluded.tasting_notes, is_available = excluded.is_available, is_published = excluded.is_published, sort_order = excluded.sort_order;
  end loop;

  delete from public.catalog_menu_items;
  delete from public.catalog_menu_sections;
  delete from public.catalog_menu_schedules;
  update public.catalog_menus set is_active = false;
  for v_menu in select * from jsonb_to_recordset(v_draft.snapshot -> 'menus') as m(id text, slug text, nameVi text, nameEn text, sortOrder integer, isActive boolean, schedules jsonb, sections jsonb)
  loop
    insert into public.catalog_menus (id, slug, name_vi, name_en, sort_order, is_active)
    values (v_menu.id, v_menu.slug, v_menu.nameVi, v_menu.nameEn, coalesce(v_menu.sortOrder, 0), coalesce(v_menu.isActive, true))
    on conflict (id) do update set slug = excluded.slug, name_vi = excluded.name_vi, name_en = excluded.name_en, sort_order = excluded.sort_order, is_active = excluded.is_active;
    for v_schedule in select value from jsonb_array_elements(coalesce(v_menu.schedules, '[]'::jsonb))
    loop
      insert into public.catalog_menu_schedules (menu_id, day_of_week, starts_at, ends_at)
      values (v_menu.id, (v_schedule ->> 'dayOfWeek')::smallint, (v_schedule ->> 'startsAt')::time, (v_schedule ->> 'endsAt')::time);
    end loop;
    for v_section in select * from jsonb_to_recordset(coalesce(v_menu.sections, '[]'::jsonb)) as s(id text, categoryId text, sortOrder integer, productIds jsonb)
    loop
      insert into public.catalog_menu_sections (id, menu_id, category_id, sort_order)
      values (v_section.id, v_menu.id, v_section.categoryId, coalesce(v_section.sortOrder, 0));
      for v_product_id in select jsonb_array_elements_text(coalesce(v_section.productIds, '[]'::jsonb))
      loop
        insert into public.catalog_menu_items (section_id, product_id, sort_order, is_visible)
        values (v_section.id, v_product_id, (select count(*) from public.catalog_menu_items where section_id = v_section.id), true)
        on conflict (section_id, product_id) do update set is_visible = true;
      end loop;
    end loop;
  end loop;

  update public.catalog_releases set status = 'archived' where status = 'published';
  update public.catalog_releases
  set status = 'published', published_by = (select auth.uid()), published_at = now(), updated_at = now()
  where id = v_draft.id;
  insert into public.catalog_publication_history (release_id, version, actor_user_id)
  values (v_draft.id, v_draft.version, (select auth.uid()));
  insert into public.catalog_releases (version, status, snapshot, created_by, updated_by)
  values (v_draft.version + 1, 'draft', v_draft.snapshot, (select auth.uid()), (select auth.uid()));
  select lock_version into draft_lock_version from public.catalog_releases where status = 'draft';
  published_version := v_draft.version;
  return next;
end;
$$;

revoke all on function public.save_catalog_draft(jsonb, bigint) from public;
revoke all on function public.publish_catalog_draft(bigint) from public;
grant execute on function public.save_catalog_draft(jsonb, bigint) to authenticated;
grant execute on function public.publish_catalog_draft(bigint) to authenticated;

create or replace function public.enforce_catalog_option_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_item_id uuid;
  v_option_set_id text;
  v_group record;
  v_selected_count integer;
begin
  v_order_item_id := (pg_catalog.to_jsonb(new) ->> case when tg_table_name = 'order_items' then 'id' else 'order_item_id' end)::uuid;
  select p.option_set_id into v_option_set_id
  from public.order_items oi
  join public.products p on p.id = oi.product_id
  where oi.id = v_order_item_id;

  if v_option_set_id is null then
    if exists (select 1 from public.order_item_options where order_item_id = v_order_item_id) then
      raise exception 'INVALID_OPTION';
    end if;
    return new;
  end if;

  if exists (
    select 1
    from public.order_item_options selected
    join public.catalog_options option on option.id = selected.option_id
    where selected.order_item_id = v_order_item_id
      and (option.option_set_id <> v_option_set_id or not option.is_active)
  ) then
    raise exception 'INVALID_OPTION';
  end if;

  for v_group in
    select group_name, min_selections, max_selections, allow_multiple
    from public.catalog_option_groups
    where option_set_id = v_option_set_id and is_active
  loop
    select count(*)::integer into v_selected_count
    from public.order_item_options selected
    join public.catalog_options option on option.id = selected.option_id
    where selected.order_item_id = v_order_item_id
      and option.option_set_id = v_option_set_id
      and option.group_name = v_group.group_name;
    if v_selected_count < v_group.min_selections or v_selected_count > v_group.max_selections
      or (not v_group.allow_multiple and v_selected_count > 1) then
      raise exception 'INVALID_OPTION_SELECTIONS';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists order_items_validate_catalog_options on public.order_items;
create constraint trigger order_items_validate_catalog_options
after insert or update on public.order_items
deferrable initially deferred
for each row execute function public.enforce_catalog_option_limits();

drop trigger if exists order_item_options_validate_catalog_options on public.order_item_options;
create constraint trigger order_item_options_validate_catalog_options
after insert or update on public.order_item_options
deferrable initially deferred
for each row execute function public.enforce_catalog_option_limits();

create or replace function public.product_is_orderable(p_product_id text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.products p
    join public.catalog_menu_items i on i.product_id = p.id and i.is_visible
    join public.catalog_menu_sections s on s.id = i.section_id
    join public.catalog_menus m on m.id = s.menu_id and m.is_active
    join public.catalog_menu_schedules h on h.menu_id = m.id
    where p.id = p_product_id
      and p.is_published
      and p.is_available
      and h.day_of_week = extract(dow from timezone('Asia/Ho_Chi_Minh', now()))::smallint
      and h.starts_at <= timezone('Asia/Ho_Chi_Minh', now())::time
      and h.ends_at > timezone('Asia/Ho_Chi_Minh', now())::time
  );
$$;

create or replace function public.enforce_orderable_catalog_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.product_is_orderable(new.product_id) then raise exception 'PRODUCT_UNAVAILABLE'; end if;
  return new;
end;
$$;

drop trigger if exists order_items_require_active_catalog on public.order_items;
create trigger order_items_require_active_catalog
before insert on public.order_items
for each row execute function public.enforce_orderable_catalog_product();

create or replace function public.sync_catalog_draft_product_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.is_available is not distinct from new.is_available) and (old.is_published is not distinct from new.is_published) then return new; end if;
  update public.catalog_releases r
  set snapshot = jsonb_set(r.snapshot, '{products}', coalesce((
    select jsonb_agg(case when item ->> 'id' = new.id then item || jsonb_build_object('isAvailable', new.is_available, 'isPublished', new.is_published) else item end order by ord)
    from jsonb_array_elements(coalesce(r.snapshot -> 'products', '[]'::jsonb)) with ordinality as entries(item, ord)
  ), '[]'::jsonb), true), lock_version = r.lock_version + 1, updated_at = now(), updated_by = (select auth.uid())
  where r.status = 'draft';
  return new;
end;
$$;

drop trigger if exists products_sync_catalog_draft_status on public.products;
create trigger products_sync_catalog_draft_status
after update of is_available, is_published on public.products
for each row execute function public.sync_catalog_draft_product_status();

grant execute on function public.product_is_orderable(text) to anon, authenticated;
