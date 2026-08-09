import Link from 'next/link';

export default function BlogPostNotFound() {
  return (
    <main className="wrap" style={{ padding: '72px 0', textAlign: 'center' }}>
      <h1>Không tìm thấy bài viết</h1>
      <p>Bài viết có thể đã được gỡ hoặc chưa được công bố.</p>
      <Link href="/blog" className="btn btn-dark btn-sm">Xem các bài viết khác</Link>
    </main>
  );
}
