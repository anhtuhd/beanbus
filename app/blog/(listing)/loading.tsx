import Link from 'next/link';
import { BLOG_POSTS } from '@/data/events';
import { getAppMode } from '@/lib/env';

export default function BlogLoading() {
  const posts = getAppMode() === 'demo' ? BLOG_POSTS : [];
  return (
    <main className="wrap noScriptContent" aria-busy="true">
      <p className="eyebrow eyebrow-green">Góc cà phê Beanbus</p>
      <h1>Kiến Thức Cà Phê &amp; Câu Chuyện Hạt</h1>
      <p>Bí quyết pha chế, kiến thức rang và câu chuyện cà phê đặc sản từ Beanbus Hải Phòng.</p>
      {posts.length > 0 ? <ul>
        {posts.map((post) => (
          <li key={post.id}>
            <strong>{post.titleVi}</strong> · {post.date} · <Link href={`/blog/${post.slug}`}>Đọc bài viết chi tiết</Link>
          </li>
        ))}
      </ul> : <p>Đang tải bài viết. <Link href="/contact">Liên hệ Beanbus</Link> để được hỗ trợ.</p>}
    </main>
  );
}
