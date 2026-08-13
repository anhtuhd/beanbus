import Link from 'next/link';
import { LocalizedText } from '@/components/ui/LocalizedText';

export default function BlogPostNotFound() {
  return (
    <main className="wrap" style={{ padding: '72px 0', textAlign: 'center' }}>
      <h1>Không tìm thấy bài viết</h1>
      <p>Bài viết có thể đã được gỡ hoặc chưa được công bố.</p>
      <Link href="/blog" className="btn btn-dark btn-sm"><LocalizedText vi="Xem các bài viết khác" en="View other posts" /></Link>
    </main>
  );
}
