'use client';

export default function EventsError({ reset }: { reset: () => void }) {
  return (
    <main className="wrap" style={{ padding: '72px 0', textAlign: 'center' }}>
      <h1>Chưa thể tải sự kiện</h1>
      <p>Vui lòng thử lại sau ít phút.</p>
      <button className="btn btn-dark btn-sm" onClick={reset}>Thử lại</button>
    </main>
  );
}
