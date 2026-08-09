create table public.events (
  id text primary key check (id ~ '^event-[a-z0-9][a-z0-9-]{0,92}$'),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,119}$'),
  title_vi text not null check (char_length(title_vi) between 3 and 180),
  title_en text not null check (char_length(title_en) between 3 and 180),
  summary_vi text not null check (char_length(summary_vi) between 10 and 500),
  summary_en text not null check (char_length(summary_en) between 10 and 500),
  description_vi text not null check (char_length(description_vi) between 20 and 10000),
  description_en text not null check (char_length(description_en) between 20 and 10000),
  starts_at timestamptz not null,
  ends_at timestamptz,
  time_label text not null check (char_length(time_label) between 3 and 50),
  location text not null check (char_length(location) between 3 and 300),
  image_url text not null check (image_url ~ '^https://'),
  max_seats integer check (max_seats is null or max_seats > 0),
  is_featured boolean not null default false,
  is_published boolean not null default false,
  published_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (not is_published or published_at is not null)
);

create table public.blog_posts (
  id text primary key check (id ~ '^post-[a-z0-9][a-z0-9-]{0,93}$'),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,119}$'),
  title_vi text not null check (char_length(title_vi) between 3 and 180),
  title_en text not null check (char_length(title_en) between 3 and 180),
  category_vi text not null check (char_length(category_vi) between 2 and 80),
  category_en text not null check (char_length(category_en) between 2 and 80),
  author text not null check (char_length(author) between 2 and 100),
  read_time_vi text not null check (char_length(read_time_vi) between 2 and 40),
  read_time_en text not null check (char_length(read_time_en) between 2 and 40),
  excerpt_vi text not null check (char_length(excerpt_vi) between 10 and 500),
  excerpt_en text not null check (char_length(excerpt_en) between 10 and 500),
  content_vi text not null check (char_length(content_vi) between 50 and 50000),
  content_en text not null check (char_length(content_en) between 50 and 50000),
  cover_image_url text not null check (cover_image_url ~ '^https://'),
  is_published boolean not null default false,
  published_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_published or published_at is not null)
);

create trigger events_set_updated_at before update on public.events
for each row execute function public.set_updated_at();
create trigger blog_posts_set_updated_at before update on public.blog_posts
for each row execute function public.set_updated_at();

alter table public.events enable row level security;
alter table public.blog_posts enable row level security;

revoke all on table public.events, public.blog_posts from anon, authenticated;
grant select on table public.events, public.blog_posts to anon, authenticated;
revoke insert, update, delete on table public.events from anon, authenticated;
revoke insert, update, delete on table public.blog_posts from anon, authenticated;
grant all on table public.events, public.blog_posts to service_role;

create policy "Public reads published events"
on public.events for select to anon, authenticated
using (is_published and published_at is not null);
create policy "Admins read all events"
on public.events for select to authenticated
using ((select public.current_user_role()) = 'admin');

create policy "Public reads published blog posts"
on public.blog_posts for select to anon, authenticated
using (is_published and published_at is not null);
create policy "Admins read all blog posts"
on public.blog_posts for select to authenticated
using ((select public.current_user_role()) = 'admin');

insert into public.events (
  id, slug, title_vi, title_en, summary_vi, summary_en, description_vi, description_en,
  starts_at, ends_at, time_label, location, image_url, max_seats, is_featured,
  is_published, published_at, sort_order
) values
(
  'event-1', 'workshop-cupping-ca-phe-dac-san-g20',
  'Workshop Cupping & Nếm Thử Cà Phê Đặc Sản G20', 'Specialty Coffee Cupping Workshop G20',
  'Trải nghiệm cupping 10 loại hạt cà phê đặc sản hàng đầu thế giới cùng Head Roaster Hiếu Bean.',
  'Experience cupping 10 world-class specialty coffee origins with Head Roaster Hiếu Bean.',
  'Hội thảo trải nghiệm thực tế quy trình Cupping tiêu chuẩn CQI. Người tham gia sẽ được hướng dẫn phân biệt các hương vị từ Floral, Fruity, Nutty đến Spices của các vùng trồng Colombia, Ethiopia, Kenya và Việt Nam.',
  'Hands-on cupping workshop following CQI standards. Participants learn to identify flavor wheels from Colombia, Ethiopia, Kenya and Vietnam origins.',
  '2026-08-20 09:00:00+07', '2026-08-20 11:30:00+07', '09:00 - 11:30',
  'Xưởng rang Beanbus — 25-27 Thanh Bình, Hải Phòng',
  'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?q=80&w=800&auto=format&fit=crop',
  15, true, true, '2026-08-01 08:00:00+07', 1
),
(
  'event-2', 'dem-nhac-acoustic-brew-and-melodies',
  'Đêm Nhạc Acoustic: Brew & Melodies', 'Acoustic Night: Brew & Melodies',
  'Đêm nhạc acoustic ấm cúng giữa lòng Hải Phòng, thưởng thức đồ uống Coldbrew sáng tạo miễn phí 01 ly.',
  'Cozy acoustic music night in Hải Phòng with 1 free signature Coldbrew drink.',
  'Cùng hòa mình vào những giai điệu mộc mạc nhẹ nhàng trong không gian quán cà phê ấm áp của Beanbus. Mỗi vé tham dự được tặng 01 ly đồ uống tùy chọn trong menu Signature.',
  'Immerse in warm acoustic melodies at Beanbus cozy café space. Each ticket includes 1 complimentary signature drink.',
  '2026-08-25 20:00:00+07', '2026-08-25 22:00:00+07', '20:00 - 22:00',
  'Beanbus Café — Tầng 2 Không Gian Ngoài Trời',
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop',
  40, true, true, '2026-08-01 08:00:00+07', 2
),
(
  'event-3', 'giai-dau-barista-pour-over-hai-phong-open-2026',
  'Giải Đấu Barista Pour-Over Hải Phòng Open 2026', 'Hải Phòng Open Pour-Over Barista Championship 2026',
  'Sân chơi giao lưu kỹ năng pha chế Pour-Over dành cho các Barista và cộng đồng yêu cà phê.',
  'Pour-over brewing competition for baristas and coffee enthusiasts across Northern Vietnam.',
  'Giải đấu quy tụ hơn 30 Barista chuyên nghiệp từ Hải Phòng, Hà Nội, Quảng Ninh. Ban giám khảo uy tín chấm điểm theo thang chuẩn World Brewers Cup.',
  'Bringing together 30+ professional baristas. Evaluated by certified judges using World Brewers Cup standards.',
  '2026-09-05 08:30:00+07', '2026-09-05 17:00:00+07', '08:30 - 17:00',
  'Sảnh Hội Trường Beanbus Coffee Roaster',
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=800&auto=format&fit=crop',
  50, false, true, '2026-08-01 08:00:00+07', 3
);

insert into public.blog_posts (
  id, slug, title_vi, title_en, category_vi, category_en, author, read_time_vi, read_time_en,
  excerpt_vi, excerpt_en, content_vi, content_en, cover_image_url, is_published, published_at, sort_order
) values
(
  'post-1', 'phan-biet-arabica-va-robusta',
  'Phân Biệt Cà Phê Arabica Và Robusta: Hương Vị & Kỹ Thuật Rang',
  'Arabica vs Robusta Coffee: Flavor Profiles & Roasting Techniques',
  'Kiến Thức Cà Phê', 'Coffee Knowledge', 'Hiếu Bean', '5 phút đọc', '5 min read',
  'Hiểu rõ sự khác biệt giữa hai giống cà phê phổ biến nhất thế giới và lý do Beanbus kết hợp chúng trong mẻ rang.',
  'Understand the key differences between the world two most popular coffee species and why Beanbus blends them.',
  E'Cà phê Arabica và Robusta là hai trụ cột chính của ngành cà phê thế giới.\n\n### 1. Hàm lượng Caffeine & Thể chất\n- **Robusta:** Hàm lượng caffeine cao từ 2.2% - 2.7%, mang lại vị đắng đậm, thể chất (body) dày dặn và độ ngậy cao.\n- **Arabica:** Hàm lượng caffeine thấp hơn (1.2% - 1.5%), hương vị thanh thoát, chứa nhiều axit tự nhiên tạo vị chua trái cây phong phú.\n\n### 2. Hương vị đặc trưng\nArabica nổi bật với hương hoa, quả mọng, caramel và mật ong. Trong khi đó, Robusta chắt lọc hương ca-cao đắng, gỗ sồi, hạt dẻ và đường thốt nốt.\n\n### 3. Bí quyết rang tại xưởng Beanbus\nTại Beanbus Roaster, chúng tôi phát triển **Roast Profile riêng** cho từng dòng hạt.',
  E'Arabica and Robusta are the two pillars of global coffee culture.\n\n### 1. Caffeine & Body\n- **Robusta:** Higher caffeine (2.2% - 2.7%), rich bitterness, full creamy body.\n- **Arabica:** Lower caffeine (1.2% - 1.5%), elegant acidity, fruity notes.\n\n### 2. Tasting Profiles\nArabica shines with floral, berry, caramel and honey notes. Robusta delivers dark cacao, oak, roasted hazelnut and palm sugar notes.',
  'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=800&auto=format&fit=crop',
  true, '2026-08-01 08:00:00+07', 1
),
(
  'post-2', 'bi-quyet-pha-cold-brew-chuan-vi-tai-nha',
  'Bí Quyết Pha Cold-Brew Đậm Vị Thanh Mát Chuẩn Quán Tại Nhà',
  'Secrets to Brewing Café-Quality Cold-Brew Coffee at Home',
  'Hướng Dẫn Pha Chế', 'Brewing Guide', 'Beanbus Barista Team', '4 phút đọc', '4 min read',
  'Tự tay ngâm ủ một bình Cold-Brew ngọt hậu, mượt mà chỉ với 3 bước đơn giản cùng hạt cà phê Beanbus.',
  'Brew a smooth, naturally sweet batch of Cold-Brew at home with just 3 simple steps.',
  E'Cold-brew là phương pháp chiết xuất cà phê bằng nước lạnh trong thời gian kéo dài 12-24 giờ.\n\n### Tỷ lệ chuẩn Beanbus:\n- Tỷ lệ: 1:10 (10g cà phê xay thô : 100ml nước lọc nguội).\n- Thời gian ủ: 14 - 16 tiếng trong ngăn mát tủ lạnh.\n- Loại hạt khuyên dùng: Hạt **Catimor Lâm Đồng Washed** hoặc **Ethiopia Yirgacheffe**.\n\n### Các bước thực hiện:\n1. Cho cà phê xay thô vào bình thuỷ tinh.\n2. Rót từ từ nước lọc nhiệt độ phòng, khuấy nhẹ cho ngấm đều.\n3. Đậy nắp kín, ủ tủ lạnh 16 tiếng sau đó lọc qua giấy lọc cà phê.',
  E'Cold-brew extracts coffee using cold water over 12-24 hours for smooth low-acid coffee.\n\n### Beanbus Golden Ratio:\n- Ratio: 1:10 (10g coarse ground coffee : 100ml cold filtered water).\n- Steeping time: 14 - 16 hours in refrigerator.\n- Recommended beans: Catimor Lam Dong Washed or Ethiopia Yirgacheffe.',
  'https://images.unsplash.com/photo-1517701604599-bb29b565090c?q=80&w=800&auto=format&fit=crop',
  true, '2026-07-25 08:00:00+07', 2
);
