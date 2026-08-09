import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/account/', '/auth/', '/order/cart', '/order/checkout', '/order/confirmation/'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
