'use client';

import { LocalizedText } from '@/components/ui/LocalizedText';

export default function BlogError({ reset }: { reset: () => void }) {
  return (
    <main className="wrap" style={{ padding: '72px 0', textAlign: 'center' }}>
      <h1><LocalizedText vi="Chưa thể tải bài viết" en="Unable to load posts" /></h1>
      <p><LocalizedText vi="Vui lòng thử lại sau ít phút." en="Please try again in a few minutes." /></p>
      <button className="btn btn-dark btn-sm" onClick={reset}><LocalizedText vi="Thử lại" en="Try again" /></button>
    </main>
  );
}
