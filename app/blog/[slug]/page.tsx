import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import BlogArticleClient from './BlogArticleClient';
import { getPublishedBlogPost } from '@/lib/content/queries';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedBlogPost(slug);
  if (!post) return { title: 'Không tìm thấy bài viết | Beanbus' };
  return {
    title: `${post.titleVi} | Beanbus`,
    description: post.excerptVi,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article', title: post.titleVi, description: post.excerptVi,
      url: `/blog/${post.slug}`, publishedTime: post.date,
      authors: [post.author], images: [{ url: post.coverImage, alt: post.titleVi }],
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPublishedBlogPost(slug);
  if (!post) notFound();
  const structuredData = {
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.titleVi,
    description: post.excerptVi, image: post.coverImage, datePublished: post.date,
    author: { '@type': 'Person', name: post.author },
    publisher: { '@type': 'Organization', name: 'Beanbus Coffee Roaster' },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} />
      <BlogArticleClient post={post} />
    </>
  );
}
