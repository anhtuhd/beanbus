import type { Metadata } from 'next';
import BlogListClient from '../BlogListClient';
import Link from 'next/link';
import { BLOG_POSTS } from '@/data/events';
import { getPublishedBlogPage, type PublishedBlogPage } from '@/lib/content/queries';
import { getAppMode } from '@/lib/env';
import { boundedPage } from '@/lib/pagination';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Kiến Thức Cà Phê & Câu Chuyện Hạt | Beanbus',
  description: 'Bí quyết pha chế, kiến thức rang và câu chuyện cà phê đặc sản từ đội ngũ Beanbus Hải Phòng.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: 'Góc Cà Phê Beanbus',
    description: 'Kiến thức pha chế và văn hóa cà phê đặc sản.',
    url: '/blog',
  },
};

function BlogNoScript({ posts, page, totalPages }: Pick<PublishedBlogPage, 'posts' | 'page' | 'totalPages'>) {
  return (
    <div className="wrap noScriptContent">
      <p className="eyebrow eyebrow-green">Góc cà phê Beanbus</p>
      <h1>Kiến Thức Cà Phê &amp; Câu Chuyện Hạt</h1>
      <p>Bí quyết pha chế, kiến thức rang và câu chuyện cà phê đặc sản từ Beanbus Hải Phòng.</p>
      <ul>
        {posts.map((post) => <li key={post.id}><Link href={`/blog/${post.slug}`}><strong>{post.titleVi}</strong> · {post.date}</Link></li>)}
      </ul>
      {totalPages > 1 && <p>{page > 1 && <><Link href={`/blog?page=${page - 1}`}>Trang trước</Link> · </>}Trang {page} / {totalPages}{page < totalPages && <> · <Link href={`/blog?page=${page + 1}`}>Trang sau</Link></>}</p>}
    </div>
  );
}

function BlogPageView({ posts, page = 1, totalPages = 1 }: Pick<PublishedBlogPage, 'posts'> & Partial<Pick<PublishedBlogPage, 'page' | 'totalPages'>>) {
  return <><BlogListClient posts={posts} page={page} totalPages={totalPages} /><noscript><BlogNoScript posts={posts} page={page} totalPages={totalPages} /></noscript></>;
}

async function ProductionBlogPage({ page }: { page: number }) {
  let result: PublishedBlogPage = { posts: [], page, totalPages: 1, totalCount: 0 };
  try {
    result = await getPublishedBlogPage(page);
  } catch {
    // ISR retries the data source after the route revalidation window.
  }
  return <BlogPageView {...result} />;
}

export default async function BlogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = boundedPage(Number.parseInt(rawPage ?? '1', 10));
  if (getAppMode() === 'demo') {
    const totalPages = Math.max(1, Math.ceil(BLOG_POSTS.length / 10));
    return <BlogPageView posts={BLOG_POSTS.slice((page - 1) * 10, page * 10)} page={page} totalPages={totalPages} />;
  }
  return <ProductionBlogPage page={page} />;
}
