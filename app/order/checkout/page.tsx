import type { Metadata } from 'next';
import CheckoutClient from './CheckoutClient';

export const metadata: Metadata = {
  title: 'Thanh toán | Beanbus Coffee Roaster',
  description: 'Hoàn tất thông tin nhận hàng và thanh toán đơn Beanbus.',
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return <CheckoutClient />;
}
