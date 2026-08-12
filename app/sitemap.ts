import type { MetadataRoute } from 'next';
import { PRODUCTS } from '@/data/products';
import { getCatalog } from '@/lib/catalog/queries';
import { getPublishedBlogPosts, getPublishedEvents } from '@/lib/content/queries';
import { getAppMode, getSiteUrl } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const catalogPromise = getAppMode() === 'demo'
    ? Promise.resolve({ products: PRODUCTS })
    : getCatalog();
  const [catalog, events, posts] = await Promise.all([
    catalogPromise, getPublishedEvents(), getPublishedBlogPosts(),
  ]);
  const routes: MetadataRoute.Sitemap = [
    ['', 'weekly', 1],
    ['/menu', 'weekly', 0.9],
    ['/about', 'monthly', 0.7],
    ['/events', 'weekly', 0.8],
    ['/blog', 'weekly', 0.8],
    ['/booking', 'monthly', 0.7],
    ['/contact', 'monthly', 0.6],
  ].map(([path, changeFrequency, priority]) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: changeFrequency as 'weekly' | 'monthly',
    priority: priority as number,
  }));

  routes.push(
    ...catalog.products.map((product) => ({
      url: `${siteUrl}/menu/${product.id}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
      images: [product.image],
    })),
    ...events.map((event) => ({
      url: `${siteUrl}/events/${event.id}`,
      lastModified: event.date,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
      images: [event.image],
    })),
    ...posts.map((post) => ({
      url: `${siteUrl}/blog/${post.slug}`,
      lastModified: post.date,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
      images: [post.coverImage],
    }))
  );
  return routes;
}
