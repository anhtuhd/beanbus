import Link from 'next/link';
import { EVENTS } from '@/data/events';
import { getAppMode } from '@/lib/env';

export default function EventsLoading() {
  const events = getAppMode() === 'demo' ? EVENTS : [];
  return (
    <main className="wrap noScriptContent" aria-busy="true">
      <p className="eyebrow eyebrow-green">Cộng đồng Beanbus</p>
      <h1>Sự Kiện &amp; Workshop Cà Phê</h1>
      <p>Nơi kết nối đam mê cà phê đặc sản tại Hải Phòng.</p>
      {events.length > 0 ? <ul>
        {events.map((event) => (
          <li key={event.id}>
            <strong>{event.titleVi}</strong> · {event.date} · {event.location} · <Link href={`/events/${event.id}`}>Chi tiết</Link>
          </li>
        ))}
      </ul> : <p>Đang tải danh sách sự kiện. <Link href="/contact">Liên hệ Beanbus</Link> để được hỗ trợ.</p>}
    </main>
  );
}
