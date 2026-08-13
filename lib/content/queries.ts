import 'server-only';

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { BLOG_POSTS, EVENTS, type BlogPost, type EventItem } from '@/data/events';
import { getAppMode } from '@/lib/env';
import { BLOG_CACHE_TAG, EVENTS_CACHE_TAG } from '@/lib/cache/tags';
import { boundedPage } from '@/lib/pagination';
import type { Database } from '@/lib/supabase/database.types';
import { createPublicSupabaseClient } from '@/lib/supabase/public-server';

type EventRow = Database['public']['Tables']['events']['Row'];
type BlogPostRow = Database['public']['Tables']['blog_posts']['Row'];
type EventListRow = Pick<EventRow, 'id' | 'slug' | 'title_vi' | 'title_en' | 'summary_vi' | 'summary_en' | 'starts_at' | 'ends_at' | 'time_label' | 'location' | 'image_url' | 'max_seats' | 'is_featured'>;
type BlogPostListRow = Pick<BlogPostRow, 'id' | 'slug' | 'title_vi' | 'title_en' | 'category_vi' | 'category_en' | 'author' | 'read_time_vi' | 'read_time_en' | 'excerpt_vi' | 'excerpt_en' | 'published_at' | 'created_at' | 'cover_image_url'>;

export type PublishedEventsPage = {
  events: EventItem[];
  page: number;
  totalPages: number;
  totalCount: number;
};

export type PublishedBlogPage = {
  posts: BlogPost[];
  page: number;
  totalPages: number;
  totalCount: number;
};

const EVENTS_PAGE_SIZE = 9;
const BLOG_PAGE_SIZE = 10;

function dateInVietnam(value: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh',
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function eventStatus(row: Pick<EventRow, 'starts_at' | 'ends_at'>): EventItem['status'] {
  const now = Date.now();
  if (new Date(row.starts_at).getTime() > now) return 'upcoming';
  if (row.ends_at && new Date(row.ends_at).getTime() < now) return 'past';
  return 'ongoing';
}

function mapEvent(row: EventRow): EventItem {
  return {
    id: row.id,
    slug: row.slug,
    titleVi: row.title_vi,
    titleEn: row.title_en,
    date: dateInVietnam(row.starts_at),
    time: row.time_label,
    location: row.location,
    summaryVi: row.summary_vi,
    summaryEn: row.summary_en,
    descriptionVi: row.description_vi,
    descriptionEn: row.description_en,
    image: row.image_url,
    isFeatured: row.is_featured,
    status: eventStatus(row),
    maxSeats: row.max_seats ?? undefined,
  };
}

function mapEventList(row: EventListRow): EventItem {
  return {
    id: row.id,
    slug: row.slug,
    titleVi: row.title_vi,
    titleEn: row.title_en,
    date: dateInVietnam(row.starts_at),
    time: row.time_label,
    location: row.location,
    summaryVi: row.summary_vi,
    summaryEn: row.summary_en,
    descriptionVi: '',
    descriptionEn: '',
    image: row.image_url,
    isFeatured: row.is_featured,
    status: eventStatus(row),
    maxSeats: row.max_seats ?? undefined,
  };
}

function mapBlogPost(row: BlogPostRow): BlogPost {
  return {
    id: row.id,
    slug: row.slug,
    titleVi: row.title_vi,
    titleEn: row.title_en,
    categoryVi: row.category_vi,
    categoryEn: row.category_en,
    author: row.author,
    date: dateInVietnam(row.published_at ?? row.created_at),
    readTime: row.read_time_vi,
    readTimeEn: row.read_time_en,
    excerptVi: row.excerpt_vi,
    excerptEn: row.excerpt_en,
    contentVi: row.content_vi,
    contentEn: row.content_en,
    coverImage: row.cover_image_url,
  };
}

function mapBlogPostList(row: BlogPostListRow): BlogPost {
  return {
    id: row.id,
    slug: row.slug,
    titleVi: row.title_vi,
    titleEn: row.title_en,
    categoryVi: row.category_vi,
    categoryEn: row.category_en,
    author: row.author,
    date: dateInVietnam(row.published_at ?? row.created_at),
    readTime: row.read_time_vi,
    readTimeEn: row.read_time_en,
    excerptVi: row.excerpt_vi,
    excerptEn: row.excerpt_en,
    contentVi: '',
    contentEn: '',
    coverImage: row.cover_image_url,
  };
}

async function loadPublishedEvents(): Promise<EventItem[]> {
  const supabase = createPublicSupabaseClient();
  const result = await supabase
    .from('events')
    .select('id, slug, title_vi, title_en, summary_vi, summary_en, description_vi, description_en, starts_at, ends_at, time_label, location, image_url, max_seats, is_featured, is_published, published_at, sort_order, created_at, updated_at')
    .eq('is_published', true)
    .order('starts_at');
  if (result.error) throw new Error('Unable to load events.');
  return result.data.map(mapEvent);
}

const getCachedPublishedEvents = unstable_cache(loadPublishedEvents, ['public-events'], {
  tags: [EVENTS_CACHE_TAG],
  revalidate: 300,
});

export const getPublishedEvents = cache(async (): Promise<EventItem[]> => {
  if (getAppMode() === 'demo') return EVENTS;
  return getCachedPublishedEvents();
});

async function loadPublishedEventsPage(page: number): Promise<PublishedEventsPage> {
  const supabase = createPublicSupabaseClient();
  const result = await supabase
    .from('events')
    .select('id, slug, title_vi, title_en, summary_vi, summary_en, starts_at, ends_at, time_label, location, image_url, max_seats, is_featured', { count: 'exact' })
    .eq('is_published', true)
    .order('starts_at')
    .range((page - 1) * EVENTS_PAGE_SIZE, page * EVENTS_PAGE_SIZE - 1);
  if (result.error) throw new Error('Unable to load events.');
  const totalCount = result.count ?? 0;
  return {
    events: result.data.map((row) => mapEventList(row)),
    page,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / EVENTS_PAGE_SIZE)),
  };
}

const getCachedPublishedEventsPage = unstable_cache(loadPublishedEventsPage, ['public-events-page'], {
  tags: [EVENTS_CACHE_TAG],
  revalidate: 300,
});

export async function getPublishedEventsPage(requestedPage = 1): Promise<PublishedEventsPage> {
  const page = boundedPage(requestedPage);
  if (getAppMode() === 'demo') {
    const totalCount = EVENTS.length;
    return {
      events: EVENTS.slice((page - 1) * EVENTS_PAGE_SIZE, page * EVENTS_PAGE_SIZE),
      page,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / EVENTS_PAGE_SIZE)),
    };
  }
  return getCachedPublishedEventsPage(page);
}

async function loadPublishedEvent(id: string): Promise<EventItem | null> {
  const supabase = createPublicSupabaseClient();
  const result = await supabase
    .from('events')
    .select('id, slug, title_vi, title_en, summary_vi, summary_en, description_vi, description_en, starts_at, ends_at, time_label, location, image_url, max_seats, is_featured, is_published, published_at, sort_order, created_at, updated_at')
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle();
  if (result.error) throw new Error('Unable to load event.');
  return result.data ? mapEvent(result.data) : null;
}

const getCachedPublishedEvent = unstable_cache(loadPublishedEvent, ['public-event'], {
  tags: [EVENTS_CACHE_TAG],
  revalidate: 300,
});

export async function getPublishedEvent(id: string): Promise<EventItem | null> {
  if (getAppMode() === 'demo') return EVENTS.find((event) => event.id === id) ?? null;
  return getCachedPublishedEvent(id);
}

async function loadPublishedBlogPosts(): Promise<BlogPost[]> {
  const supabase = createPublicSupabaseClient();
  const result = await supabase
    .from('blog_posts')
    .select('id, slug, title_vi, title_en, category_vi, category_en, author, read_time_vi, read_time_en, excerpt_vi, excerpt_en, content_vi, content_en, cover_image_url, is_published, published_at, sort_order, created_at, updated_at')
    .eq('is_published', true)
    .order('published_at', { ascending: false });
  if (result.error) throw new Error('Unable to load blog posts.');
  return result.data.map(mapBlogPost);
}

const getCachedPublishedBlogPosts = unstable_cache(loadPublishedBlogPosts, ['public-blog'], {
  tags: [BLOG_CACHE_TAG],
  revalidate: 3600,
});

export const getPublishedBlogPosts = cache(async (): Promise<BlogPost[]> => {
  if (getAppMode() === 'demo') return BLOG_POSTS;
  return getCachedPublishedBlogPosts();
});

async function loadPublishedBlogPage(page: number): Promise<PublishedBlogPage> {
  const supabase = createPublicSupabaseClient();
  const result = await supabase
    .from('blog_posts')
    .select('id, slug, title_vi, title_en, category_vi, category_en, author, read_time_vi, read_time_en, excerpt_vi, excerpt_en, published_at, created_at, cover_image_url', { count: 'exact' })
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .range((page - 1) * BLOG_PAGE_SIZE, page * BLOG_PAGE_SIZE - 1);
  if (result.error) throw new Error('Unable to load blog posts.');
  const totalCount = result.count ?? 0;
  return {
    posts: result.data.map((row) => mapBlogPostList(row)),
    page,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / BLOG_PAGE_SIZE)),
  };
}

const getCachedPublishedBlogPage = unstable_cache(loadPublishedBlogPage, ['public-blog-page'], {
  tags: [BLOG_CACHE_TAG],
  revalidate: 3600,
});

export async function getPublishedBlogPage(requestedPage = 1): Promise<PublishedBlogPage> {
  const page = boundedPage(requestedPage);
  if (getAppMode() === 'demo') {
    const totalCount = BLOG_POSTS.length;
    return {
      posts: BLOG_POSTS.slice((page - 1) * BLOG_PAGE_SIZE, page * BLOG_PAGE_SIZE),
      page,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / BLOG_PAGE_SIZE)),
    };
  }
  return getCachedPublishedBlogPage(page);
}

async function loadPublishedBlogPost(slug: string): Promise<BlogPost | null> {
  const supabase = createPublicSupabaseClient();
  const result = await supabase
    .from('blog_posts')
    .select('id, slug, title_vi, title_en, category_vi, category_en, author, read_time_vi, read_time_en, excerpt_vi, excerpt_en, content_vi, content_en, cover_image_url, is_published, published_at, sort_order, created_at, updated_at')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();
  if (result.error) throw new Error('Unable to load blog post.');
  return result.data ? mapBlogPost(result.data) : null;
}

const getCachedPublishedBlogPost = unstable_cache(loadPublishedBlogPost, ['public-blog-post'], {
  tags: [BLOG_CACHE_TAG],
  revalidate: 3600,
});

export async function getPublishedBlogPost(slug: string): Promise<BlogPost | null> {
  if (getAppMode() === 'demo') return BLOG_POSTS.find((post) => post.slug === slug) ?? null;
  return getCachedPublishedBlogPost(slug);
}
