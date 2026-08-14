create or replace function public.enforce_catalog_media_url()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
begin
  v_url := pg_catalog.to_jsonb(new) ->> case when tg_table_name = 'blog_posts' then 'cover_image_url' else 'image_url' end;
  if v_url is null then
    return new;
  end if;
  if v_url ~ '^https://'
    and v_url !~ '^https://images\.beanbus\.store/media/(product|event|blog)/[0-9]{4}/[0-9]{2}/[0-9a-f-]+\.(webp|jpe?g|png)$'
    and v_url !~ '^https://images\.unsplash\.com/' then
    raise exception 'INVALID_MEDIA_URL';
  end if;
  return new;
end;
$$;

drop trigger if exists products_guard_catalog_media_url on public.products;
create trigger products_guard_catalog_media_url
before insert or update of image_url on public.products
for each row execute function public.enforce_catalog_media_url();

drop trigger if exists events_guard_catalog_media_url on public.events;
create trigger events_guard_catalog_media_url
before insert or update of image_url on public.events
for each row execute function public.enforce_catalog_media_url();

drop trigger if exists blog_posts_guard_catalog_media_url on public.blog_posts;
create trigger blog_posts_guard_catalog_media_url
before insert or update of cover_image_url on public.blog_posts
for each row execute function public.enforce_catalog_media_url();

revoke all on function public.enforce_catalog_media_url() from public;
