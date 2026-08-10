import type { Metadata } from 'next';
import ContactClient from './ContactClient';

export const metadata: Metadata = {
  title: 'Liên Hệ Beanbus Coffee Roaster Hải Phòng',
  description: 'Liên hệ Beanbus Coffee Roaster để đặt đồ, đặt hạt cà phê sỉ lẻ hoặc gửi yêu cầu hợp tác.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Liên Hệ Beanbus Coffee Roaster',
    description: 'Kết nối với Beanbus Coffee Roaster tại Hải Phòng.',
    url: '/contact',
  },
};

export default function ContactPage() {
  return <ContactClient />;
}
