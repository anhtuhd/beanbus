import type { Metadata } from 'next';
import BlogListClient from './BlogListClient';
import { getPublishedBlogPosts } from '@/lib/content/queries';

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

export default async function BlogPage() {
  const posts = await getPublishedBlogPosts();
  return <BlogListClient posts={posts} />;
}
