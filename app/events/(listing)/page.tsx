import type { Metadata } from 'next';
import EventsClient from '../EventsClient';
import Link from 'next/link';
import { EVENTS, type EventItem } from '@/data/events';
import { getPublishedEvents } from '@/lib/content/queries';
import { getAppMode } from '@/lib/env';

export const revalidate = 300;

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

function EventsNoScript({ events }: { events: EventItem[] }) {
  return (
    <div className="wrap noScriptContent">
      <p className="eyebrow eyebrow-green">Cộng đồng Beanbus</p>
      <h1>Sự Kiện &amp; Workshop Cà Phê</h1>
      <p>Nơi kết nối đam mê cà phê đặc sản tại Hải Phòng.</p>
      <ul>
        {events.map((event) => <li key={event.id}><Link href={`/events/${event.id}`}><strong>{event.titleVi}</strong> · {event.date} · {event.location}</Link></li>)}
      </ul>
    </div>
  );
}

function EventsPageView({ events }: { events: EventItem[] }) {
  return <><EventsClient events={events} /><noscript><EventsNoScript events={events} /></noscript></>;
}

async function ProductionEventsPage() {
  let events: EventItem[] = [];
  try {
    events = await getPublishedEvents();
  } catch {
    // ISR retries the data source after the route revalidation window.
  }
  return <EventsPageView events={events} />;
}

export default function EventsPage() {
  if (getAppMode() === 'demo') return <EventsPageView events={EVENTS} />;
  return <ProductionEventsPage />;
}
