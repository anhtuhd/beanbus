import type { Metadata } from 'next';
import CartClient from './CartClient';

export const metadata: Metadata = {
  title: 'Giỏ hàng | Beanbus Coffee Roaster',
  description: 'Kiểm tra món đã chọn trước khi tiếp tục thanh toán tại Beanbus.',
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return <CartClient />;
}
