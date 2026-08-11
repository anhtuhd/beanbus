import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import BlogArticleClient from './BlogArticleClient';
import type { BlogPost } from '@/data/events';
import { getPublishedBlogPost } from '@/lib/content/queries';

type Props = { params: Promise<{ slug: string }> };

function renderVietnameseContent(content: string) {
  return content.split(/\n{2,}/).filter(Boolean).map((block, index) => {
    if (block.startsWith('### ')) return <h2 key={index}>{block.slice(4)}</h2>;
    const lines = block.split('\n');
    if (lines.every((line) => line.startsWith('- '))) {
      return <ul key={index}>{lines.map((line) => <li key={line}>{line.slice(2)}</li>)}</ul>;
    }
    if (lines.every((line) => /^\d+\. /.test(line))) {
      return <ol key={index}>{lines.map((line) => <li key={line}>{line.replace(/^\d+\. /, '')}</li>)}</ol>;
    }
    return <p key={index}>{block}</p>;
  });
}

function BlogArticleNoScript({ post }: { post: BlogPost }) {
  return (
    <main className="wrap noScriptContent">
      <p className="eyebrow eyebrow-green">Góc cà phê Beanbus</p>
      <Link href="/blog">Quay lại danh sách bài viết</Link>
      <article>
        <p>{post.categoryVi}</p>
        <h1>{post.titleVi}</h1>
        <p>{post.author} · {post.date} · {post.readTime}</p>
        <p>{post.excerptVi}</p>
        <div>{renderVietnameseContent(post.contentVi)}</div>
      </article>
    </main>
  );
}

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
      <Script
        id="blog-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      <BlogArticleClient post={post} />
      <BlogArticleNoScript post={post} />
    </>
  );
}
