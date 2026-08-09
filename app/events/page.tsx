import type { Metadata } from 'next';
import EventsClient from './EventsClient';
import { getPublishedEvents } from '@/lib/content/queries';

export const metadata: Metadata = {
  title: 'Sự Kiện & Workshop Cà Phê | Beanbus Coffee Roaster',
  description: 'Workshop cupping, đêm nhạc và hoạt động cộng đồng cà phê đặc sản tại Beanbus Hải Phòng.',
  alternates: { canonical: '/events' },
  openGraph: {
    title: 'Sự Kiện & Workshop Cà Phê | Beanbus',
    description: 'Gặp gỡ cộng đồng cà phê đặc sản tại Hải Phòng.',
    url: '/events',
  },
};

export default async function EventsPage() {
  const events = await getPublishedEvents();
  return <EventsClient events={events} />;
}
