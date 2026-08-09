export interface EventItem {
  id: string;
  titleVi: string;
  titleEn: string;
  date: string;
  time: string;
  location: string;
  summaryVi: string;
  summaryEn: string;
  descriptionVi: string;
  descriptionEn: string;
  image: string;
  isFeatured?: boolean;
  status: 'upcoming' | 'ongoing' | 'past';
  maxSeats?: number;
  registeredSeats?: number;
}

export const EVENTS: EventItem[] = [
  {
    id: 'event-1',
    titleVi: 'Workshop Cupping & Nếm Thử Cà Phê Đặc Sản G20',
    titleEn: 'Specialty Coffee Cupping Workshop G20',
    date: '2026-08-20',
    time: '09:00 - 11:30',
    location: 'Xưởng rang Beanbus — 25-27 Thanh Bình, Hải Phòng',
    summaryVi: 'Trải nghiệm cupping 10 loại hạt cà phê đặc sản hàng đầu thế giới cùng Head Roaster Hiếu Bean.',
    summaryEn: 'Experience cupping 10 world-class specialty coffee origins with Head Roaster Hiếu Bean.',
    descriptionVi: 'Hội thảo trải nghiệm thực tế quy trình Cupping tiêu chuẩn CQI. Người tham gia sẽ được hướng dẫn phân biệt các hương vị từ Floral, Fruity, Nutty đến Spices của các vùng trồng Colombia, Ethiopia, Kenya và Việt Nam.',
    descriptionEn: 'Hands-on cupping workshop following CQI standards. Participants learn to identify flavor wheels from Colombia, Ethiopia, Kenya and Vietnam origins.',
    image: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?q=80&w=800&auto=format&fit=crop',
    isFeatured: true,
    status: 'upcoming',
    maxSeats: 15,
    registeredSeats: 9,
  },
  {
    id: 'event-2',
    titleVi: 'Đêm Nhạc Acoustic: Brew & Melodies',
    titleEn: 'Acoustic Night: Brew & Melodies',
    date: '2026-08-25',
    time: '20:00 - 22:00',
    location: 'Beanbus Café — Tầng 2 Không Gian Ngoài Trời',
    summaryVi: 'Đêm nhạc acoustic ấm cúng giữa lòng Hải Phòng, thưởng thức đồ uống Coldbrew sáng tạo miễn phí 01 ly.',
    summaryEn: 'Cozy acoustic music night in Hải Phòng with 1 free signature Coldbrew drink.',
    descriptionVi: 'Cùng hòa mình vào những giai điệu mộc mạc nhẹ nhàng trong không gian quán cà phê ấm áp của Beanbus. Mỗi vé tham dự được tặng 01 ly đồ uống tùy chọn trong menu Signature.',
    descriptionEn: 'Immerse in warm acoustic melodies at Beanbus cozy café space. Each ticket includes 1 complimentary signature drink.',
    image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop',
    isFeatured: true,
    status: 'upcoming',
    maxSeats: 40,
    registeredSeats: 28,
  },
  {
    id: 'event-3',
    titleVi: 'Giải Đấu Barista Pour-Over Hải Phòng Open 2026',
    titleEn: 'Hải Phòng Open Pour-Over Barista Championship 2026',
    date: '2026-09-05',
    time: '08:30 - 17:00',
    location: 'Sảnh Hội Trường Beanbus Coffee Roaster',
    summaryVi: 'Sân chơi giao lưu kỹ năng pha chế Pour-Over dành cho các Barista và cộng đồng yêu cà phê.',
    summaryEn: 'Pour-over brewing competition for baristas and coffee enthusiasts across Northern Vietnam.',
    descriptionVi: 'Giải đấu quy tụ hơn 30 Barista chuyên nghiệp từ Hải Phòng, Hà Nội, Quảng Ninh. Ban giám khảo uy tín chấm điểm theo thang chuẩn World Brewers Cup.',
    descriptionEn: 'Bringing together 30+ professional baristas. Evaluated by certified judges using World Brewers Cup standards.',
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=800&auto=format&fit=crop',
    status: 'upcoming',
    maxSeats: 50,
    registeredSeats: 35,
  }
];

export interface BlogPost {
  id: string;
  slug: string;
  titleVi: string;
  titleEn: string;
  categoryVi: string;
  categoryEn: string;
  author: string;
  date: string;
  readTime: string;
  excerptVi: string;
  excerptEn: string;
  contentVi: string;
  contentEn: string;
  coverImage: string;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    id: 'post-1',
    slug: 'phan-biet-arabica-va-robusta',
    titleVi: 'Phân Biệt Cà Phê Arabica Và Robusta: Hương Vị & Kỹ Thuật Rang',
    titleEn: 'Arabica vs Robusta Coffee: Flavor Profiles & Roasting Techniques',
    categoryVi: 'Kiến Thức Cà Phê',
    categoryEn: 'Coffee Knowledge',
    author: 'Hiếu Bean',
    date: '2026-08-01',
    readTime: '5 phút đọc',
    excerptVi: 'Hiểu rõ sự khác biệt giữa hai giống cà phê phổ biến nhất thế giới và lý do Beanbus kết hợp chúng trong mẻ rang.',
    excerptEn: 'Understand the key differences between the world two most popular coffee species and why Beanbus blends them.',
    contentVi: `Cà phê Arabica và Robusta là hai trụ cột chính của ngành cà phê thế giới.

### 1. Hàm lượng Caffeine & Thể chất
- **Robusta:** Hàm lượng caffeine cao từ 2.2% - 2.7%, mang lại vị đắng đậm, thể chất (body) dày dặn và độ ngậy cao.
- **Arabica:** Hàm lượng caffeine thấp hơn (1.2% - 1.5%), hương vị thanh thoát, chứa nhiều axit tự nhiên tạo vị chua trái cây phong phú.

### 2. Hương vị đặc trưng
Arabica nổi bật với hương hoa, quả mọng, caramel và mật ong. Trong khi đó, Robusta chắt lọc hương ca-cao đắng, gỗ sồi, hạt dẻ và đường thốt nốt.

### 3. Bí quyết rang tại xưởng Beanbus
Tại Beanbus Roaster, chúng tôi phát triển **Roast Profile riêng** cho từng dòng hạt. Với Fine Robusta Gia Lai, kỹ thuật rang Medium-Dark được áp dụng để khử bớt vị chát gắt, đẩy vị ngọt hậu. Với Arabica Cầu Đất, dải nhiệt rang Medium giữ trọn độ chua sáng và hương thơm hoa trái.`,
    contentEn: `Arabica and Robusta are the two pillars of global coffee culture.

### 1. Caffeine & Body
- **Robusta:** Higher caffeine (2.2% - 2.7%), rich bitterness, full creamy body.
- **Arabica:** Lower caffeine (1.2% - 1.5%), elegant acidity, fruity notes.

### 2. Tasting Profiles
Arabica shines with floral, berry, caramel and honey notes. Robusta delivers dark cacao, oak, roasted hazelnut and palm sugar notes.`,
    coverImage: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'post-2',
    slug: 'bi-quyet-pha-cold-brew-chuan-vi-tai-nha',
    titleVi: 'Bí Quyết Pha Cold-Brew Đậm Vị Thanh Mát Chuẩn Quán Tại Nhà',
    titleEn: 'Secrets to Brewing Café-Quality Cold-Brew Coffee at Home',
    categoryVi: 'Hướng Dẫn Pha Chế',
    categoryEn: 'Brewing Guide',
    author: 'Beanbus Barista Team',
    date: '2026-07-25',
    readTime: '4 phút đọc',
    excerptVi: 'Tự tay ngâm ủ một bình Cold-Brew ngọt hậu, mượt mà chỉ với 3 bước đơn giản cùng hạt cà phê Beanbus.',
    excerptEn: 'Brew a smooth, naturally sweet batch of Cold-Brew at home with just 3 simple steps.',
    contentVi: `Cold-brew là phương pháp chiết xuất cà phê bằng nước lạnh trong thời gian kéo dài 12-24 giờ.

### Tỷ lệ chuẩn Beanbus:
- Tỷ lệ: 1:10 (10g cà phê xay thô : 100ml nước lọc nguội).
- Thời gian ủ: 14 - 16 tiếng trong ngăn mát tủ lạnh.
- Loại hạt khuyên dùng: Hạt **Catimor Lâm Đồng Washed** hoặc **Ethiopia Yirgacheffe**.

### Các bước thực hiện:
1. Cho cà phê xay thô vào bình thuỷ tinh.
2. Rót từ từ nước lọc nhiệt độ phòng, khuấy nhẹ cho ngấm đều.
3. Đậy nắp kín, ủ tủ lạnh 16 tiếng sau đó lọc qua giấy lọc cà phê. Thưởng thức cùng đá lạnh hoặc lát cam vàng!`,
    contentEn: `Cold-brew extracts coffee using cold water over 12-24 hours for smooth low-acid coffee.

### Beanbus Golden Ratio:
- Ratio: 1:10 (10g coarse ground coffee : 100ml cold filtered water).
- Steeping time: 14 - 16 hours in refrigerator.`,
    coverImage: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?q=80&w=800&auto=format&fit=crop',
  }
];
