'use client';

export default function BlogError({ reset }: { reset: () => void }) {
  return (
    <main className="wrap" style={{ padding: '72px 0', textAlign: 'center' }}>
      <h1>Chưa thể tải bài viết</h1>
      <p>Vui lòng thử lại sau ít phút.</p>
      <button className="btn btn-dark btn-sm" onClick={reset}>Thử lại</button>
    </main>
  );
}
