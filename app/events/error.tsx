'use client';

import { LocalizedText } from '@/components/ui/LocalizedText';

export default function EventsError({ reset }: { reset: () => void }) {
  return (
    <main className="wrap" style={{ padding: '72px 0', textAlign: 'center' }}>
      <h1><LocalizedText vi="Chưa thể tải sự kiện" en="Unable to load events" /></h1>
      <p><LocalizedText vi="Vui lòng thử lại sau ít phút." en="Please try again in a few minutes." /></p>
      <button className="btn btn-dark btn-sm" onClick={reset}><LocalizedText vi="Thử lại" en="Try again" /></button>
    </main>
  );
}
