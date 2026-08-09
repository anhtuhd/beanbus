export interface ProductOption {
  id: string;
  group: string; // 'size' | 'sugar' | 'ice' | 'topping'
  nameVi: string;
  nameEn: string;
  extraPrice: number;
}

export interface Product {
  id: string;
  categoryId: string;
  nameVi: string;
  nameEn: string;
  descriptionVi: string;
  descriptionEn: string;
  price: number;
  image: string;
  badge?: 'best' | 'seasonal' | 'new' | 'signature';
  isAvailable: boolean;
  tastingNotes?: string;
  options?: ProductOption[];
}

export interface Category {
  id: string;
  nameVi: string;
  nameEn: string;
  icon?: string;
}

export const CATEGORIES: Category[] = [
  { id: 'all', nameVi: 'Tất Cả', nameEn: 'All Items' },
  { id: 'colddrip', nameVi: 'Cold-Drip', nameEn: 'Cold-Drip Bar' },
  { id: 'coldbrew', nameVi: 'Cold-Brew', nameEn: 'Cold-Brew' },
  { id: 'espresso', nameVi: 'Espresso Bar', nameEn: 'Espresso Bar' },
  { id: 'vietnamese', nameVi: 'Cà Phê Việt', nameEn: 'Vietnamese Coffee' },
  { id: 'matcha-choc', nameVi: 'Matcha & Choc', nameEn: 'Matcha & Chocolate' },
  { id: 'tea-juice', nameVi: 'Trà & Juice', nameEn: 'Tea & Juice' },
  { id: 'pastry', nameVi: 'Bánh Tươi', nameEn: 'Fresh Pastries' },
  { id: 'combo', nameVi: 'Combo & Set', nameEn: 'Combo & Sets' },
  { id: 'seasonal', nameVi: 'Món Theo Mùa', nameEn: 'Seasonal Specials' },
];

export const COMMON_OPTIONS: ProductOption[] = [
  { id: 'size-m', group: 'size', nameVi: 'Size Vừa (Medium)', nameEn: 'Medium Size', extraPrice: 0 },
  { id: 'size-l', group: 'size', nameVi: 'Size Lớn (Large)', nameEn: 'Large Size', extraPrice: 10000 },
  { id: 'sugar-100', group: 'sugar', nameVi: '100% Đường', nameEn: '100% Sugar', extraPrice: 0 },
  { id: 'sugar-70', group: 'sugar', nameVi: '70% Đường', nameEn: '70% Sugar', extraPrice: 0 },
  { id: 'sugar-50', group: 'sugar', nameVi: '50% Đường', nameEn: '50% Sugar', extraPrice: 0 },
  { id: 'sugar-0', group: 'sugar', nameVi: 'Không Đường', nameEn: 'No Sugar', extraPrice: 0 },
  { id: 'ice-100', group: 'ice', nameVi: '100% Đá', nameEn: 'Normal Ice', extraPrice: 0 },
  { id: 'ice-50', group: 'ice', nameVi: 'Ít Đá', nameEn: 'Less Ice', extraPrice: 0 },
  { id: 'topping-cream', group: 'topping', nameVi: 'Thêm Kem Mặn (Salted Cream)', nameEn: 'Add Salted Cream', extraPrice: 10000 },
  { id: 'topping-espresso', group: 'topping', nameVi: 'Thêm Shot Espresso', nameEn: 'Extra Espresso Shot', extraPrice: 15000 },
];

export const PRODUCTS: Product[] = [
  {
    id: 'cd-1',
    categoryId: 'colddrip',
    nameVi: 'Cold-drip Quế Hoa',
    nameEn: 'Osmanthus Cold-drip',
    descriptionVi: 'Cà phê Cold-drip chưng cất 12 tiếng kết hợp cùng hương hoa quế thanh nhẹ, tạo cảm giác vô cùng sảng khoái.',
    descriptionEn: '12-hour cold drip coffee infused with delicate osmanthus flowers, incredibly refreshing.',
    price: 35000,
    image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?q=80&w=800&auto=format&fit=crop',
    badge: 'best',
    isAvailable: true,
    tastingNotes: 'Hoa quế, Mật ong, Trái cây mọng',
    options: COMMON_OPTIONS,
  },
  {
    id: 'cb-1',
    categoryId: 'coldbrew',
    nameVi: 'Coldbrew Mãng Cầu',
    nameEn: 'Soursop Coldbrew',
    descriptionVi: 'Coldbrew nguyên chất phối hợp mứt mãng cầu xiêm chua ngọt & nước ép táo xanh thanh mát.',
    descriptionEn: 'Pure coldbrew blended with sweet-tangy soursop jam and fresh green apple juice.',
    price: 40000,
    image: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?q=80&w=800&auto=format&fit=crop',
    badge: 'best',
    isAvailable: true,
    tastingNotes: 'Mãng cầu, Táo xanh, Caramel',
    options: COMMON_OPTIONS,
  },
  {
    id: 'cb-2',
    categoryId: 'coldbrew',
    nameVi: 'Coldbrew Mont Blanc',
    nameEn: 'Mont Blanc Coldbrew',
    descriptionVi: 'Coldbrew thượng hạng kết hợp hương cam vàng tươi và lớp kem mặn béo ngậy sành điệu.',
    descriptionEn: 'Premium coldbrew infused with fresh orange peel and topped with signature salted foam.',
    price: 40000,
    image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?q=80&w=800&auto=format&fit=crop',
    badge: 'signature',
    isAvailable: true,
    tastingNotes: 'Vỏ cam, Kem mặn, Hạnh nhân',
    options: COMMON_OPTIONS,
  },
  {
    id: 'esp-1',
    categoryId: 'espresso',
    nameVi: 'Cà Phê Kem Béo (Creamy Foam)',
    nameEn: 'Creamy Foam Coffee',
    descriptionVi: 'Espresso Arabica nguyên chất kết hợp sữa tươi thanh trùng và lớp kem tươi đánh béo ngậy.',
    descriptionEn: 'Arabica espresso with pasteurized fresh milk and thick whipped cream foam.',
    price: 40000,
    image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?q=80&w=800&auto=format&fit=crop',
    badge: 'best',
    isAvailable: true,
    tastingNotes: 'Kem béo, Sô-cô-la, Hạt dẻ',
    options: COMMON_OPTIONS,
  },
  {
    id: 'esp-2',
    categoryId: 'espresso',
    nameVi: 'Cappuccino Đặc Sản',
    nameEn: 'Specialty Cappuccino',
    descriptionVi: 'Espresso đôi chắt lọc từ hạt Arabica Cầu Đất, phủ bọt sữa mịn màng nghệ thuật Latte Art.',
    descriptionEn: 'Double espresso shot from Cầu Đất Arabica with silky micro-foam milk art.',
    price: 45000,
    image: 'https://images.unsplash.com/photo-1534778101976-62847782c213?q=80&w=800&auto=format&fit=crop',
    isAvailable: true,
    tastingNotes: 'Vanilla, Caramel, Bơ',
    options: COMMON_OPTIONS,
  },
  {
    id: 'esp-3',
    categoryId: 'espresso',
    nameVi: 'Flat White Beanbus',
    nameEn: 'Beanbus Flat White',
    descriptionVi: 'Sự cân bằng hoàn hảo giữa Ristretto đậm đà và bọt sữa mỏng êm ái.',
    descriptionEn: 'Smooth balance of rich Ristretto shots and velvet steamed milk.',
    price: 45000,
    image: 'https://images.unsplash.com/photo-1577968897966-3d4325b36b61?q=80&w=800&auto=format&fit=crop',
    isAvailable: true,
    options: COMMON_OPTIONS,
  },
  {
    id: 'vn-1',
    categoryId: 'vietnamese',
    nameVi: 'Cà Phê Muối Hải Phòng',
    nameEn: 'Hải Phòng Salted Coffee',
    descriptionVi: 'Phin Robusta Honey đượm vị truyền thống cùng lớp kem muối biển độc quyền Beanbus.',
    descriptionEn: 'Traditional Robusta Honey filter coffee topped with Beanbus signature sea salt cream.',
    price: 35000,
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=800&auto=format&fit=crop',
    badge: 'signature',
    isAvailable: true,
    tastingNotes: 'Kem muối, Ca-cao, Đường thốt nốt',
    options: COMMON_OPTIONS,
  },
  {
    id: 'vn-2',
    categoryId: 'vietnamese',
    nameVi: 'Cà Phê Trứng Hà Nội',
    nameEn: 'Hanoi Egg Coffee',
    descriptionVi: 'Lòng đỏ trứng tươi đánh bông mịn ngậy quyện cùng espresso nóng thơm lừng.',
    descriptionEn: 'Whipped fresh egg yolk cream layered over piping hot rich espresso.',
    price: 45000,
    image: 'https://images.unsplash.com/photo-1509785307050-d4066910ec1e?q=80&w=800&auto=format&fit=crop',
    isAvailable: true,
    tastingNotes: 'Kem trứng, Mật ong, Ca-cao',
    options: COMMON_OPTIONS,
  },
  {
    id: 'mat-1',
    categoryId: 'matcha-choc',
    nameVi: 'Uji Matcha Oat Latte',
    nameEn: 'Uji Matcha Oat Latte',
    descriptionVi: 'Bột Matcha thượng hạng nhập khẩu Uji Kyoto pha chế cùng sữa yến mạch Oatside thơm bùi.',
    descriptionEn: 'Premium Kyoto Uji Matcha whisked with creamy Oatside oat milk.',
    price: 55000,
    image: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?q=80&w=800&auto=format&fit=crop',
    badge: 'new',
    isAvailable: true,
    tastingNotes: 'Matcha Uji, Sữa yến mạch, Hạt dẻ',
    options: COMMON_OPTIONS,
  },
  {
    id: 'tea-1',
    categoryId: 'tea-juice',
    nameVi: 'Trà Oolong Đào Hoa Kem Béo',
    nameEn: 'Peach Blossom Oolong Foam',
    descriptionVi: 'Trà Oolong Bảo Lộc ủ lạnh ngát hương đào tươi và lớp foam milk mọng êm.',
    descriptionEn: 'Cold-brewed Bảo Lộc Oolong tea infused with juicy peach slices and cream foam.',
    price: 45000,
    image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?q=80&w=800&auto=format&fit=crop',
    isAvailable: true,
    tastingNotes: 'Hương đào, Hoa nhài, Oolong thanh mát',
    options: COMMON_OPTIONS,
  },
  {
    id: 'pas-1',
    categoryId: 'pastry',
    nameVi: 'Croissant Bơ Pháp Tươi',
    nameEn: 'Fresh French Butter Croissant',
    descriptionVi: 'Bánh sừng bò ngàn lớp nướng nóng giòn tan mỗi ngày từ bơ Elle & Vire Pháp cao cấp.',
    descriptionEn: 'Flaky 100-layer French butter croissant baked fresh twice daily.',
    price: 35000,
    image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?q=80&w=800&auto=format&fit=crop',
    badge: 'best',
    isAvailable: true,
  },
  {
    id: 'pas-2',
    categoryId: 'pastry',
    nameVi: 'Bánh Tiramisu Espresso Beanbus',
    nameEn: 'Beanbus Espresso Tiramisu',
    descriptionVi: 'Bánh Tiramisu phong cách Ý tẩm đượm cốt espresso rang mộc đậm đà & phô mai Mascarpone.',
    descriptionEn: 'Classic Italian Tiramisu soaked in fresh Beanbus espresso & silky Mascarpone.',
    price: 48000,
    image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?q=80&w=800&auto=format&fit=crop',
    badge: 'signature',
    isAvailable: true,
  },
  {
    id: 'sea-1',
    categoryId: 'seasonal',
    nameVi: 'Coldbrew Vải Thiều Thiều Hoa',
    nameEn: 'Lychee Blossom Coldbrew',
    descriptionVi: 'Món đặc sản mùa hè với vải thiều Lục Ngạn tươi kết hợp Coldbrew hạt Colombia.',
    descriptionEn: 'Summer special featuring fresh sweet lychees and Colombia coldbrew.',
    price: 48000,
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?q=80&w=800&auto=format&fit=crop',
    badge: 'seasonal',
    isAvailable: true,
    tastingNotes: 'Vải thiều, Hoa hồng, Citrus',
    options: COMMON_OPTIONS,
  },
  {
    id: 'com-1',
    categoryId: 'combo',
    nameVi: 'Combo Sáng Brew & Bakery',
    nameEn: 'Morning Brew & Bakery Combo',
    descriptionVi: '1 Ly Cà Phê Kem Béo / Salted Coffee + 1 Bánh Croissant Bơ Pháp nướng giòn.',
    descriptionEn: '1 Creamy Foam/Salted Coffee + 1 Fresh French Butter Croissant.',
    price: 65000,
    image: 'https://images.unsplash.com/photo-1509785307050-d4066910ec1e?q=80&w=800&auto=format&fit=crop',
    badge: 'best',
    isAvailable: true,
  }
];
