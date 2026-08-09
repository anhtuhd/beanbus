import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import EventDetailClient from './EventDetailClient';
import { getPublishedEvent } from '@/lib/content/queries';

type Props = { params: Promise<{ id: string }> };

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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} />
      <EventDetailClient event={event} />
    </>
  );
}
