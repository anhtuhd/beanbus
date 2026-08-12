import type { Metadata } from 'next';
import CartClient from './CartClient';
import { PRODUCTS, type Product } from '@/data/products';
import { getCatalog } from '@/lib/catalog/queries';
import { getAppMode } from '@/lib/env';

export const metadata: Metadata = {
  title: 'Giỏ hàng | Beanbus Coffee Roaster',
  description: 'Kiểm tra món đã chọn trước khi tiếp tục thanh toán tại Beanbus.',
  robots: { index: false, follow: false },
};

export const revalidate = 300;

export default async function CartPage() {
  let products: Product[] = getAppMode() === 'demo' ? PRODUCTS : [];
  if (getAppMode() === 'production') {
    try {
      products = (await getCatalog()).products;
    } catch {
      // The cart remains usable; catalog sync will retry on the next catalog route.
    }
  }
  return <CartClient catalogProducts={products} />;
}
