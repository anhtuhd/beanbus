import type { Metadata } from 'next';
import './globals.css';
import { LanguageProvider } from '@/context/LanguageContext';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';
import { OrderProvider } from '@/context/OrderContext';
import { StoreSettingsProvider } from '@/context/StoreSettingsContext';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CartDrawer } from '@/components/ui/CartDrawer';
import { assertProductionEnv, getAppMode, getSiteUrl } from '@/lib/env';

assertProductionEnv();
const appMode = getAppMode();
const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: 'Beanbus Coffee Roaster — Brew Better Every Day',
  description:
    'Beanbus Coffee Roaster — Quán cà phê & xưởng rang đặc sản tại Hải Phòng. Đồ uống tinh tế, bánh tươi, hạt cà phê rang sỉ & lẻ. Brew Better Every Day.',
  keywords: [
    'Beanbus Coffee',
    'Beanbus Hải Phòng',
    'Cà phê đặc sản Hải Phòng',
    'Xưởng rang cà phê Hải Phòng',
    'Specialty coffee Hai Phong',
    'Hiếu Bean',
    'Cold-drip Quế Hoa',
    'Cà phê muối Hải Phòng',
  ],
  authors: [{ name: 'Beanbus Coffee Roaster Team' }],
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: 'Beanbus Coffee Roaster — Brew Better Every Day',
    description: 'Cà phê đặc sản từ farm đến cup tại Hải Phòng.',
    url: siteUrl,
    siteName: 'Beanbus Coffee Roaster',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?q=80&w=1200&auto=format&fit=crop',
        width: 1200,
        height: 630,
        alt: 'Beanbus Coffee Roaster',
      },
    ],
    locale: 'vi_VN',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const localBusiness = {
    '@context': 'https://schema.org',
    '@type': 'CafeOrCoffeeShop',
    name: 'Beanbus Coffee Roaster',
    url: siteUrl,
    image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?q=80&w=1200&auto=format&fit=crop',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '25-27 Thanh Bình',
      addressLocality: 'Hải Phòng',
      addressCountry: 'VN',
    },
  };
  return (
    <html lang="vi" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js');" }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusiness).replace(/</g, '\\u003c') }} />
        <LanguageProvider>
          <AuthProvider mode={appMode}>
            <StoreSettingsProvider>
              <OrderProvider>
                <CartProvider>
                  <Header />
                  <main style={{ paddingTop: '78px' }}>
                    {appMode === 'demo' && (
                      <div className="demo-notice" role="status">
                        <strong>DEMO</strong>
                        <span>Đăng nhập, thanh toán, điểm và quản trị đang dùng dữ liệu thử trên trình duyệt.</span>
                      </div>
                    )}
                    {children}
                  </main>
                  <CartDrawer />
                  <Footer />
                </CartProvider>
              </OrderProvider>
            </StoreSettingsProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
