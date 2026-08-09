create table public.catalog_categories (
  id text primary key,
  name_vi text not null,
  name_en text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.catalog_option_sets (
  id text primary key,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.catalog_options (
  id text primary key,
  option_set_id text not null references public.catalog_option_sets (id) on delete cascade,
  group_name text not null check (group_name in ('size', 'sugar', 'ice', 'topping')),
  name_vi text not null,
  name_en text not null,
  extra_price_vnd integer not null default 0 check (extra_price_vnd >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id text primary key,
  category_id text not null references public.catalog_categories (id),
  option_set_id text references public.catalog_option_sets (id),
  name_vi text not null,
  name_en text not null,
  description_vi text not null default '',
  description_en text not null default '',
  price_vnd integer not null check (price_vnd >= 0),
  image_url text not null,
  badge text check (badge in ('best', 'seasonal', 'new', 'signature')),
  tasting_notes text,
  is_available boolean not null default true,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.products is 'Canonical catalog and pricing source for menu display and server-priced orders.';
comment on column public.products.price_vnd is 'Canonical base price in whole Vietnamese dong.';

create index products_category_sort_idx
on public.products (category_id, sort_order)
where is_published;

create index catalog_options_set_sort_idx
on public.catalog_options (option_set_id, sort_order)
where is_active;

alter table public.catalog_categories enable row level security;
alter table public.catalog_option_sets enable row level security;
alter table public.catalog_options enable row level security;
alter table public.products enable row level security;

revoke all on table public.catalog_categories, public.catalog_option_sets, public.catalog_options, public.products
from anon, authenticated;
grant select on table public.catalog_categories, public.catalog_option_sets, public.catalog_options, public.products
to anon, authenticated;
grant insert, update, delete on table public.catalog_categories, public.catalog_option_sets, public.catalog_options, public.products
to authenticated;
grant all on table public.catalog_categories, public.catalog_option_sets, public.catalog_options, public.products
to service_role;

create policy "Public can read active catalog categories"
on public.catalog_categories for select
to anon, authenticated
using (is_active);

create policy "Public can read active option sets"
on public.catalog_option_sets for select
to anon, authenticated
using (is_active);

create policy "Public can read active catalog options"
on public.catalog_options for select
to anon, authenticated
using (
  is_active and exists (
    select 1 from public.catalog_option_sets
    where catalog_option_sets.id = catalog_options.option_set_id
      and catalog_option_sets.is_active
  )
);

create policy "Public can read published products"
on public.products for select
to anon, authenticated
using (is_published);

create policy "Admins manage catalog categories"
on public.catalog_categories for all to authenticated
using ((select public.current_user_role()) = 'admin')
with check ((select public.current_user_role()) = 'admin');

create policy "Admins manage catalog option sets"
on public.catalog_option_sets for all to authenticated
using ((select public.current_user_role()) = 'admin')
with check ((select public.current_user_role()) = 'admin');

create policy "Admins manage catalog options"
on public.catalog_options for all to authenticated
using ((select public.current_user_role()) = 'admin')
with check ((select public.current_user_role()) = 'admin');

create policy "Admins manage products"
on public.products for all to authenticated
using ((select public.current_user_role()) = 'admin')
with check ((select public.current_user_role()) = 'admin');

create trigger catalog_categories_set_updated_at
before update on public.catalog_categories
for each row execute function public.set_updated_at();

create trigger catalog_option_sets_set_updated_at
before update on public.catalog_option_sets
for each row execute function public.set_updated_at();

create trigger catalog_options_set_updated_at
before update on public.catalog_options
for each row execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

insert into public.catalog_categories (id, name_vi, name_en, sort_order) values
  ('colddrip', 'Cold-Drip', 'Cold-Drip Bar', 10),
  ('coldbrew', 'Cold-Brew', 'Cold-Brew', 20),
  ('espresso', 'Espresso Bar', 'Espresso Bar', 30),
  ('vietnamese', 'Cà Phê Việt', 'Vietnamese Coffee', 40),
  ('matcha-choc', 'Matcha & Choc', 'Matcha & Chocolate', 50),
  ('tea-juice', 'Trà & Juice', 'Tea & Juice', 60),
  ('pastry', 'Bánh Tươi', 'Fresh Pastries', 70),
  ('combo', 'Combo & Set', 'Combo & Sets', 80),
  ('seasonal', 'Món Theo Mùa', 'Seasonal Specials', 90);

insert into public.catalog_option_sets (id, name) values
  ('standard-drink', 'Standard drink customization');

insert into public.catalog_options (
  id, option_set_id, group_name, name_vi, name_en, extra_price_vnd, sort_order
) values
  ('size-m', 'standard-drink', 'size', 'Size Vừa (Medium)', 'Medium Size', 0, 10),
  ('size-l', 'standard-drink', 'size', 'Size Lớn (Large)', 'Large Size', 10000, 20),
  ('sugar-100', 'standard-drink', 'sugar', '100% Đường', '100% Sugar', 0, 30),
  ('sugar-70', 'standard-drink', 'sugar', '70% Đường', '70% Sugar', 0, 40),
  ('sugar-50', 'standard-drink', 'sugar', '50% Đường', '50% Sugar', 0, 50),
  ('sugar-0', 'standard-drink', 'sugar', 'Không Đường', 'No Sugar', 0, 60),
  ('ice-100', 'standard-drink', 'ice', '100% Đá', 'Normal Ice', 0, 70),
  ('ice-50', 'standard-drink', 'ice', 'Ít Đá', 'Less Ice', 0, 80),
  ('topping-cream', 'standard-drink', 'topping', 'Thêm Kem Mặn (Salted Cream)', 'Add Salted Cream', 10000, 90),
  ('topping-espresso', 'standard-drink', 'topping', 'Thêm Shot Espresso', 'Extra Espresso Shot', 15000, 100);

insert into public.products (
  id, category_id, option_set_id, name_vi, name_en, description_vi, description_en,
  price_vnd, image_url, badge, tasting_notes, is_available, is_published, sort_order
) values
  ('cd-1', 'colddrip', 'standard-drink', 'Cold-drip Quế Hoa', 'Osmanthus Cold-drip', 'Cà phê Cold-drip chưng cất 12 tiếng kết hợp cùng hương hoa quế thanh nhẹ, tạo cảm giác vô cùng sảng khoái.', '12-hour cold drip coffee infused with delicate osmanthus flowers, incredibly refreshing.', 35000, 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?q=80&w=800&auto=format&fit=crop', 'best', 'Hoa quế, Mật ong, Trái cây mọng', true, true, 10),
  ('cb-1', 'coldbrew', 'standard-drink', 'Coldbrew Mãng Cầu', 'Soursop Coldbrew', 'Coldbrew nguyên chất phối hợp mứt mãng cầu xiêm chua ngọt & nước ép táo xanh thanh mát.', 'Pure coldbrew blended with sweet-tangy soursop jam and fresh green apple juice.', 40000, 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?q=80&w=800&auto=format&fit=crop', 'best', 'Mãng cầu, Táo xanh, Caramel', true, true, 20),
  ('cb-2', 'coldbrew', 'standard-drink', 'Coldbrew Mont Blanc', 'Mont Blanc Coldbrew', 'Coldbrew thượng hạng kết hợp hương cam vàng tươi và lớp kem mặn béo ngậy sành điệu.', 'Premium coldbrew infused with fresh orange peel and topped with signature salted foam.', 40000, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?q=80&w=800&auto=format&fit=crop', 'signature', 'Vỏ cam, Kem mặn, Hạnh nhân', true, true, 30),
  ('esp-1', 'espresso', 'standard-drink', 'Cà Phê Kem Béo (Creamy Foam)', 'Creamy Foam Coffee', 'Espresso Arabica nguyên chất kết hợp sữa tươi thanh trùng và lớp kem tươi đánh béo ngậy.', 'Arabica espresso with pasteurized fresh milk and thick whipped cream foam.', 40000, 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?q=80&w=800&auto=format&fit=crop', 'best', 'Kem béo, Sô-cô-la, Hạt dẻ', true, true, 40),
  ('esp-2', 'espresso', 'standard-drink', 'Cappuccino Đặc Sản', 'Specialty Cappuccino', 'Espresso đôi chắt lọc từ hạt Arabica Cầu Đất, phủ bọt sữa mịn màng nghệ thuật Latte Art.', 'Double espresso shot from Cầu Đất Arabica with silky micro-foam milk art.', 45000, 'https://images.unsplash.com/photo-1534778101976-62847782c213?q=80&w=800&auto=format&fit=crop', null, 'Vanilla, Caramel, Bơ', true, true, 50),
  ('esp-3', 'espresso', 'standard-drink', 'Flat White Beanbus', 'Beanbus Flat White', 'Sự cân bằng hoàn hảo giữa Ristretto đậm đà và bọt sữa mỏng êm ái.', 'Smooth balance of rich Ristretto shots and velvet steamed milk.', 45000, 'https://images.unsplash.com/photo-1577968897966-3d4325b36b61?q=80&w=800&auto=format&fit=crop', null, null, true, true, 60),
  ('vn-1', 'vietnamese', 'standard-drink', 'Cà Phê Muối Hải Phòng', 'Hải Phòng Salted Coffee', 'Phin Robusta Honey đượm vị truyền thống cùng lớp kem muối biển độc quyền Beanbus.', 'Traditional Robusta Honey filter coffee topped with Beanbus signature sea salt cream.', 35000, 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=800&auto=format&fit=crop', 'signature', 'Kem muối, Ca-cao, Đường thốt nốt', true, true, 70),
  ('vn-2', 'vietnamese', 'standard-drink', 'Cà Phê Trứng Hà Nội', 'Hanoi Egg Coffee', 'Lòng đỏ trứng tươi đánh bông mịn ngậy quyện cùng espresso nóng thơm lừng.', 'Whipped fresh egg yolk cream layered over piping hot rich espresso.', 45000, 'https://images.unsplash.com/photo-1585806450638-aa2377b587a8?q=80&w=800&auto=format&fit=crop', null, 'Kem trứng, Mật ong, Ca-cao', true, true, 80),
  ('mat-1', 'matcha-choc', 'standard-drink', 'Uji Matcha Oat Latte', 'Uji Matcha Oat Latte', 'Bột Matcha thượng hạng nhập khẩu Uji Kyoto pha chế cùng sữa yến mạch Oatside thơm bùi.', 'Premium Kyoto Uji Matcha whisked with creamy Oatside oat milk.', 55000, 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?q=80&w=800&auto=format&fit=crop', 'new', 'Matcha Uji, Sữa yến mạch, Hạt dẻ', true, true, 90),
  ('tea-1', 'tea-juice', 'standard-drink', 'Trà Oolong Đào Hoa Kem Béo', 'Peach Blossom Oolong Foam', 'Trà Oolong Bảo Lộc ủ lạnh ngát hương đào tươi và lớp foam milk mọng êm.', 'Cold-brewed Bảo Lộc Oolong tea infused with juicy peach slices and cream foam.', 45000, 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?q=80&w=800&auto=format&fit=crop', null, 'Hương đào, Hoa nhài, Oolong thanh mát', true, true, 100),
  ('pas-1', 'pastry', null, 'Croissant Bơ Pháp Tươi', 'Fresh French Butter Croissant', 'Bánh sừng bò ngàn lớp nướng nóng giòn tan mỗi ngày từ bơ Elle & Vire Pháp cao cấp.', 'Flaky 100-layer French butter croissant baked fresh twice daily.', 35000, 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?q=80&w=800&auto=format&fit=crop', 'best', null, true, true, 110),
  ('pas-2', 'pastry', null, 'Bánh Tiramisu Espresso Beanbus', 'Beanbus Espresso Tiramisu', 'Bánh Tiramisu phong cách Ý tẩm đượm cốt espresso rang mộc đậm đà & phô mai Mascarpone.', 'Classic Italian Tiramisu soaked in fresh Beanbus espresso & silky Mascarpone.', 48000, 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?q=80&w=800&auto=format&fit=crop', 'signature', null, true, true, 120),
  ('sea-1', 'seasonal', 'standard-drink', 'Coldbrew Vải Thiều Thiều Hoa', 'Lychee Blossom Coldbrew', 'Món đặc sản mùa hè với vải thiều Lục Ngạn tươi kết hợp Coldbrew hạt Colombia.', 'Summer special featuring fresh sweet lychees and Colombia coldbrew.', 48000, 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?q=80&w=800&auto=format&fit=crop', 'seasonal', 'Vải thiều, Hoa hồng, Citrus', true, true, 130),
  ('com-1', 'combo', null, 'Combo Sáng Brew & Bakery', 'Morning Brew & Bakery Combo', '1 Ly Cà Phê Kem Béo / Salted Coffee + 1 Bánh Croissant Bơ Pháp nướng giòn.', '1 Creamy Foam/Salted Coffee + 1 Fresh French Butter Croissant.', 65000, 'https://images.unsplash.com/photo-1509785307050-d4066910ec1e?q=80&w=800&auto=format&fit=crop', 'best', null, true, true, 140);
