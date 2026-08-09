import 'server-only';

import { cache } from 'react';
import { BLOG_POSTS, EVENTS, type BlogPost, type EventItem } from '@/data/events';
import { getAppMode } from '@/lib/env';
import type { Database } from '@/lib/supabase/database.types';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type EventRow = Database['public']['Tables']['events']['Row'];
type BlogPostRow = Database['public']['Tables']['blog_posts']['Row'];

function dateInVietnam(value: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh',
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function eventStatus(row: EventRow): EventItem['status'] {
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

export const getPublishedEvents = cache(async (): Promise<EventItem[]> => {
  if (getAppMode() === 'demo') return EVENTS;
  const supabase = await createServerSupabaseClient();
  const result = await supabase
    .from('events')
    .select('id, slug, title_vi, title_en, summary_vi, summary_en, description_vi, description_en, starts_at, ends_at, time_label, location, image_url, max_seats, is_featured, is_published, published_at, sort_order, created_at, updated_at')
    .eq('is_published', true)
    .order('starts_at');
  if (result.error) throw new Error('Unable to load events.');
  return result.data.map(mapEvent);
});

const findPublishedEvent = cache(async (id: string): Promise<EventItem | null> => {
  if (getAppMode() === 'demo') return EVENTS.find((event) => event.id === id) ?? null;
  const supabase = await createServerSupabaseClient();
  const result = await supabase
    .from('events')
    .select('id, slug, title_vi, title_en, summary_vi, summary_en, description_vi, description_en, starts_at, ends_at, time_label, location, image_url, max_seats, is_featured, is_published, published_at, sort_order, created_at, updated_at')
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle();
  if (result.error) throw new Error('Unable to load event.');
  return result.data ? mapEvent(result.data) : null;
});

export async function getPublishedEvent(id: string): Promise<EventItem | null> {
  return findPublishedEvent(id);
}

export const getPublishedBlogPosts = cache(async (): Promise<BlogPost[]> => {
  if (getAppMode() === 'demo') return BLOG_POSTS;
  const supabase = await createServerSupabaseClient();
  const result = await supabase
    .from('blog_posts')
    .select('id, slug, title_vi, title_en, category_vi, category_en, author, read_time_vi, read_time_en, excerpt_vi, excerpt_en, content_vi, content_en, cover_image_url, is_published, published_at, sort_order, created_at, updated_at')
    .eq('is_published', true)
    .order('published_at', { ascending: false });
  if (result.error) throw new Error('Unable to load blog posts.');
  return result.data.map(mapBlogPost);
});

const findPublishedBlogPost = cache(async (slug: string): Promise<BlogPost | null> => {
  if (getAppMode() === 'demo') return BLOG_POSTS.find((post) => post.slug === slug) ?? null;
  const supabase = await createServerSupabaseClient();
  const result = await supabase
    .from('blog_posts')
    .select('id, slug, title_vi, title_en, category_vi, category_en, author, read_time_vi, read_time_en, excerpt_vi, excerpt_en, content_vi, content_en, cover_image_url, is_published, published_at, sort_order, created_at, updated_at')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();
  if (result.error) throw new Error('Unable to load blog post.');
  return result.data ? mapBlogPost(result.data) : null;
});

export async function getPublishedBlogPost(slug: string): Promise<BlogPost | null> {
  return findPublishedBlogPost(slug);
}
