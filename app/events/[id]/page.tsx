import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import EventDetailClient from './EventDetailClient';
import type { EventItem } from '@/data/events';
import { getPublishedEvent } from '@/lib/content/queries';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

function EventDetailNoScript({ event }: { event: EventItem }) {
  return (
    <main className="wrap noScriptContent">
      <p className="eyebrow eyebrow-green">Cộng đồng Beanbus</p>
      <Link href="/events">Tất cả sự kiện</Link>
      <article>
        <h1>{event.titleVi}</h1>
        <p>{event.summaryVi}</p>
        <ul>
          <li>Ngày: {event.date}</li>
          <li>Thời gian: {event.time}</li>
          <li>Địa điểm: {event.location}</li>
          {event.maxSeats && <li>Số chỗ tối đa: {event.maxSeats}</li>}
        </ul>
        <p>{event.descriptionVi}</p>
        <p><Link href="/events">Mở trang sự kiện để đăng ký tham gia</Link></p>
      </article>
    </main>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = await getPublishedEvent(id);
  if (!event) return { title: 'Không tìm thấy sự kiện | Beanbus' };
  return {
    title: `${event.titleVi} | Beanbus`,
    description: event.summaryVi,
    alternates: { canonical: `/events/${event.id}` },
    openGraph: {
      type: 'article', title: event.titleVi, description: event.summaryVi,
      url: `/events/${event.id}`, images: [{ url: event.image, alt: event.titleVi }],
    },
  };
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params;
  const event = await getPublishedEvent(id);
  if (!event) notFound();
  const structuredData = {
    '@context': 'https://schema.org', '@type': 'Event', name: event.titleVi,
    description: event.summaryVi, image: [event.image], startDate: `${event.date}T${event.time.slice(0, 5)}:00+07:00`,
    location: { '@type': 'Place', name: 'Beanbus Coffee Roaster', address: event.location },
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  };
  return (
    <>
      <Script
        id="event-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      <EventDetailClient event={event} />
      <EventDetailNoScript event={event} />
    </>
  );
}
