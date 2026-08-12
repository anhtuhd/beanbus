import type { Metadata } from 'next';
import BlogListClient from '../BlogListClient';
import Link from 'next/link';
import { BLOG_POSTS, type BlogPost } from '@/data/events';
import { getPublishedBlogPosts } from '@/lib/content/queries';
import { getAppMode } from '@/lib/env';

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

function BlogNoScript({ posts }: { posts: BlogPost[] }) {
  return (
    <div className="wrap noScriptContent">
      <p className="eyebrow eyebrow-green">Góc cà phê Beanbus</p>
      <h1>Kiến Thức Cà Phê &amp; Câu Chuyện Hạt</h1>
      <p>Bí quyết pha chế, kiến thức rang và câu chuyện cà phê đặc sản từ Beanbus Hải Phòng.</p>
      <ul>
        {posts.map((post) => <li key={post.id}><Link href={`/blog/${post.slug}`}><strong>{post.titleVi}</strong> · {post.date}</Link></li>)}
      </ul>
    </div>
  );
}

function BlogPageView({ posts }: { posts: BlogPost[] }) {
  return <><BlogListClient posts={posts} /><noscript><BlogNoScript posts={posts} /></noscript></>;
}

async function ProductionBlogPage() {
  let posts: BlogPost[] = [];
  try {
    posts = await getPublishedBlogPosts();
  } catch {
    // ISR retries the data source after the route revalidation window.
  }
  return <BlogPageView posts={posts} />;
}

export default function BlogPage() {
  if (getAppMode() === 'demo') return <BlogPageView posts={BLOG_POSTS} />;
  return <ProductionBlogPage />;
}
