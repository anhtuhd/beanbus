import Link from 'next/link';
import { LocalizedText } from '@/components/ui/LocalizedText';

export default function EventNotFound() {
  return (
    <main className="wrap" style={{ padding: '72px 0', textAlign: 'center' }}>
      <h1>Không tìm thấy sự kiện</h1>
      <p>Sự kiện có thể đã được gỡ hoặc chưa được công bố.</p>
      <Link href="/events" className="btn btn-dark btn-sm"><LocalizedText vi="Xem các sự kiện khác" en="View other events" /></Link>
    </main>
  );
}
