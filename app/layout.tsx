import type { Metadata } from 'next';
import localFont from 'next/font/local';
import Script from 'next/script';
import { SpeedInsights } from '@vercel/speed-insights/next';
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
import { BRAND_ASSETS } from '@/lib/brand/assets';

const montserrat = localFont({
  variable: '--font-montserrat',
  display: 'swap',
  preload: false,
  src: [
    { path: './fonts/Montserrat-SemiBold.ttf', weight: '600', style: 'normal' },
    { path: './fonts/Montserrat-Bold.otf', weight: '700', style: 'normal' },
    { path: './fonts/Montserrat-ExtraBold.ttf', weight: '800', style: 'normal' },
    { path: './fonts/Montserrat-Black.otf', weight: '900', style: 'normal' },
  ],
});

const poppins = localFont({
  variable: '--font-poppins',
  display: 'swap',
  preload: false,
  src: [
    { path: './fonts/Poppins-Regular.ttf', weight: '400', style: 'normal' },
    { path: './fonts/Poppins-Medium.ttf', weight: '500', style: 'normal' },
    { path: './fonts/Poppins-SemiBold.ttf', weight: '600', style: 'normal' },
  ],
});

const handwritten = localFont({
  variable: '--font-handwritten',
  display: 'swap',
  preload: false,
  src: './fonts/Handwritten.ttf',
});

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
        url: BRAND_ASSETS.hero,
        width: 1200,
        height: 630,
        alt: 'Beanbus Coffee Roaster',
      },
    ],
    locale: 'vi_VN',
    type: 'website',
  },
  icons: { icon: BRAND_ASSETS.icon },
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
    image: `${siteUrl}${BRAND_ASSETS.hero}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: '25-27 Thanh Bình',
      addressLocality: 'Hải Phòng',
      addressCountry: 'VN',
    },
  };
  return (
    <html lang="vi" data-scroll-behavior="smooth" className={`${montserrat.variable} ${poppins.variable} ${handwritten.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script id="set-js-class" strategy="beforeInteractive">
          {"document.documentElement.classList.add('js');"}
        </Script>
        <Script
          id="local-business-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusiness).replace(/</g, '\\u003c') }}
        />
        <LanguageProvider>
          <AuthProvider mode={appMode}>
            <StoreSettingsProvider mode={appMode}>
              <OrderProvider mode={appMode}>
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
        <SpeedInsights />
      </body>
    </html>
  );
}
