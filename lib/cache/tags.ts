import 'server-only';

import { updateTag } from 'next/cache';

export const CATALOG_CACHE_TAG = 'public-catalog';
export const EVENTS_CACHE_TAG = 'public-events';
export const BLOG_CACHE_TAG = 'public-blog';

export function invalidateCatalogCache(): void {
  updateTag(CATALOG_CACHE_TAG);
}

export function invalidateEventsCache(): void {
  updateTag(EVENTS_CACHE_TAG);
}

export function invalidateBlogCache(): void {
  updateTag(BLOG_CACHE_TAG);
}
