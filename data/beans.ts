export interface CoffeeBean {
  id: string;
  name: string;
  origin: string;
  process: string;
  roastLevel: string;
  tastingNotes: string;
  cuppingScore: number;
  priceRetail250g: number;
  priceWholesaleKg: number;
  descriptionVi: string;
  descriptionEn: string;
  image: string;
  isBestseller?: boolean;
}

export const COFFEE_BEANS: CoffeeBean[] = [
  {
    id: 'bean-1',
    name: 'Fine Robusta Honey',
    origin: 'Gia Lai, Việt Nam',
    process: 'Honey Processed',
    roastLevel: 'Medium-Dark',
    tastingNotes: 'Chocolate, Brown Sugar, Cacao, Nutty',
    cuppingScore: 84.5,
    priceRetail250g: 140000,
    priceWholesaleKg: 380000,
    descriptionVi: 'Hạt Fine Robusta chất lượng cao từ nông hộ Gia Lai. Thích hợp pha Phin & Espresso đậm đà, hậu vị ngọt kéo dài.',
    descriptionEn: 'High quality Fine Robusta from Gia Lai farms. Perfect for strong Phin & bold Espresso with long sweet finish.',
    image: 'https://images.unsplash.com/photo-1587734195503-904fca47e0e9?q=80&w=800&auto=format&fit=crop',
    isBestseller: true,
  },
  {
    id: 'bean-2',
    name: 'Catimor Lâm Đồng Washed',
    origin: 'Đà Lạt, Lâm Đồng',
    process: 'Fully Washed',
    roastLevel: 'Medium',
    tastingNotes: 'Fruity, Orange, Lemon, Caramel',
    cuppingScore: 83.0,
    priceRetail250g: 165000,
    priceWholesaleKg: 450000,
    descriptionVi: 'Arabica Catimor vùng cao Cầu Đất, độ chua thanh sảng khoái và hương thơm mượt mà.',
    descriptionEn: 'Highland Catimor Arabica from Cầu Đất, bright acidity with smooth aroma.',
    image: 'https://images.unsplash.com/photo-1611854779393-1b2da9d400fe?q=80&w=800&auto=format&fit=crop',
    isBestseller: true,
  },
  {
    id: 'bean-3',
    name: 'Indonesia Sumatra Mandheling',
    origin: 'Sumatra, Indonesia',
    process: 'Giling Basah (Wet-Hulled)',
    roastLevel: 'Medium-Dark',
    tastingNotes: 'Orange peel, Spice, Hazelnut, Cedar',
    cuppingScore: 85.5,
    priceRetail250g: 250000,
    priceWholesaleKg: 780000,
    descriptionVi: 'Hạt Sumatra trứ danh với thể chất dày (Full body), hương gia vị thảo mộc cùng vị cam dịu nhẹ.',
    descriptionEn: 'Renowned Sumatra beans with full body, herbal spice complexity and muted citrus notes.',
    image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'bean-4',
    name: 'Ethiopia Yirgacheffe Washed',
    origin: 'Yirgacheffe, Ethiopia',
    process: 'Washed G1',
    roastLevel: 'Light-Medium',
    tastingNotes: 'Bergamot, Jasmine, Lemon, Honey-like',
    cuppingScore: 88.0,
    priceRetail250g: 300000,
    priceWholesaleKg: 950000,
    descriptionVi: 'Hạt cà phê đặc sản hàng đầu thế giới từ nôi cà phê Ethiopia. Nổi bật với hương hoa cam nhài tinh tế.',
    descriptionEn: 'World top specialty beans from Ethiopia birthplace. Outstanding jasmine and bergamot floral notes.',
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=800&auto=format&fit=crop',
    isBestseller: true,
  },
  {
    id: 'bean-5',
    name: 'Ethiopia Whiskey Vanilla Special Process',
    origin: 'Guji, Ethiopia',
    process: 'Anaerobic Barrel Aged',
    roastLevel: 'Light',
    tastingNotes: 'Whiskey, Vanilla, Toffee, Creamy',
    cuppingScore: 89.5,
    priceRetail250g: 400000,
    priceWholesaleKg: 1350000,
    descriptionVi: 'Dòng hạt cao cấp ủ thùng gỗ sồi ủ rượu Whiskey. Hương thơm quyến rũ vượt trội dành cho Pour Over & Drip.',
    descriptionEn: 'Exclusive oak barrel-aged Guji beans infused with rich whiskey and vanilla aroma.',
    image: 'https://images.unsplash.com/photo-1524350876685-274059332603?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'bean-6',
    name: 'Colombia Cauca Paraiso 92',
    origin: 'Cauca, Colombia',
    process: 'Thermal Shock Fermentation',
    roastLevel: 'Light',
    tastingNotes: 'Strawberry, Citrus, Sweet & Clean',
    cuppingScore: 90.0,
    priceRetail250g: 400000,
    priceWholesaleKg: 1400000,
    descriptionVi: 'Siêu phẩm cà phê đặc sản từ nông trang Paraiso 92 Colombia. Hương dâu tây và hoa quả lên men cực kỳ nổi bật.',
    descriptionEn: 'Ultra-specialty Colombia Paraiso 92 beans. Extraordinary strawberry fermentation explosion.',
    image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'bean-7',
    name: 'Costa Rica Geisha Red Honey',
    origin: 'Tarrazú, Costa Rica',
    process: 'Red Honey',
    roastLevel: 'Light',
    tastingNotes: 'Floral, Peach, Citrus, Raspberry',
    cuppingScore: 92.0,
    priceRetail250g: 1200000, // 250g or per 15g brew
    priceWholesaleKg: 3800000,
    descriptionVi: 'Giống hạt Geisha huyền thoại. Sự kết hợp hoàn mỹ giữa hương hoa trắng, đào chín và vị thanh khiết đỉnh cao.',
    descriptionEn: 'Legendary Geisha variety. Perfect harmony of white floral notes, ripe peach and pristine clarity.',
    image: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?q=80&w=800&auto=format&fit=crop',
  }
];
