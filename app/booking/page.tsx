import type { Metadata } from 'next';
import BookingClient from './BookingClient';

export const metadata: Metadata = {
  title: 'Đặt Bàn Tại Beanbus | Coffee Roaster Hải Phòng',
  description: 'Đặt bàn trước tại Beanbus Coffee Roaster Hải Phòng và chọn khung giờ, khu vực ngồi phù hợp.',
  alternates: { canonical: '/booking' },
  openGraph: {
    title: 'Đặt Bàn Tại Beanbus',
    description: 'Giữ chỗ cho trải nghiệm cà phê đặc sản tại Beanbus Hải Phòng.',
    url: '/booking',
  },
};

export default function BookingPage() {
  return <BookingClient />;
}
