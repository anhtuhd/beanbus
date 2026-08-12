import type { Metadata } from 'next';
import CheckoutClient from './CheckoutClient';
import { PRODUCTS, type Product } from '@/data/products';
import { getCatalog } from '@/lib/catalog/queries';
import { getAppMode } from '@/lib/env';

export const metadata: Metadata = {
  title: 'Thanh toán | Beanbus Coffee Roaster',
  description: 'Hoàn tất thông tin nhận hàng và thanh toán đơn Beanbus.',
  robots: { index: false, follow: false },
};

export const revalidate = 300;

export default async function CheckoutPage() {
  let products: Product[] = getAppMode() === 'demo' ? PRODUCTS : [];
  if (getAppMode() === 'production') {
    try {
      products = (await getCatalog()).products;
    } catch {
      // Checkout remains usable; the server pricing RPC stays authoritative.
    }
  }
  return <CheckoutClient catalogProducts={products} />;
}
