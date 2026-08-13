import type { Metadata } from 'next';
import EventsClient from '../EventsClient';
import Link from 'next/link';
import { EVENTS } from '@/data/events';
import { getPublishedEventsPage, type PublishedEventsPage } from '@/lib/content/queries';
import { getAppMode } from '@/lib/env';
import { boundedPage } from '@/lib/pagination';

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

function EventsNoScript({ events, page, totalPages }: Pick<PublishedEventsPage, 'events' | 'page' | 'totalPages'>) {
  return (
    <div className="wrap noScriptContent">
      <p className="eyebrow eyebrow-green">Cộng đồng Beanbus</p>
      <h1>Sự Kiện &amp; Workshop Cà Phê</h1>
      <p>Nơi kết nối đam mê cà phê đặc sản tại Hải Phòng.</p>
      <ul>
        {events.map((event) => <li key={event.id}><Link href={`/events/${event.id}`}><strong>{event.titleVi}</strong> · {event.date} · {event.location}</Link></li>)}
      </ul>
      {totalPages > 1 && <p>{page > 1 && <><Link href={`/events?page=${page - 1}`}>Trang trước</Link> · </>}Trang {page} / {totalPages}{page < totalPages && <> · <Link href={`/events?page=${page + 1}`}>Trang sau</Link></>}</p>}
    </div>
  );
}

function EventsPageView({ events, page = 1, totalPages = 1 }: Pick<PublishedEventsPage, 'events'> & Partial<Pick<PublishedEventsPage, 'page' | 'totalPages'>>) {
  return <><EventsClient events={events} page={page} totalPages={totalPages} /><noscript><EventsNoScript events={events} page={page} totalPages={totalPages} /></noscript></>;
}

async function ProductionEventsPage({ page }: { page: number }) {
  let result: PublishedEventsPage = { events: [], page, totalPages: 1, totalCount: 0 };
  try {
    result = await getPublishedEventsPage(page);
  } catch {
    // ISR retries the data source after the route revalidation window.
  }
  return <EventsPageView {...result} />;
}

export default async function EventsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = boundedPage(Number.parseInt(rawPage ?? '1', 10));
  if (getAppMode() === 'demo') {
    const totalPages = Math.max(1, Math.ceil(EVENTS.length / 9));
    return <EventsPageView events={EVENTS.slice((page - 1) * 9, page * 9)} page={page} totalPages={totalPages} />;
  }
  return <ProductionEventsPage page={page} />;
}
