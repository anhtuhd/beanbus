import type { Metadata } from 'next';
import AboutClient from './AboutClient';

export const metadata: Metadata = {
  title: 'Về Beanbus Coffee Roaster | Cà Phê Đặc Sản Hải Phòng',
  description: 'Câu chuyện, quy trình rang và định hướng phát triển cà phê đặc sản của Beanbus tại Hải Phòng.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'Về Beanbus Coffee Roaster',
    description: 'Hành trình từ nông trại đến ly cà phê đặc sản Beanbus.',
    url: '/about',
  },
};

export default function AboutPage() {
  return <AboutClient />;
}
