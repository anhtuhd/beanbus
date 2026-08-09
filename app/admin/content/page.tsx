import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Search } from 'lucide-react';
import ContentPublicationForm from './ContentPublicationForm';
import styles from '../requests/requests.module.css';
import { requireAdmin } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
type ContentRow = {
  id: string; image: string; isPublished: boolean; label: string;
  publicPath: string; secondary: string; title: string;
};
const PAGE_SIZE = 20;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function contentLink(type: string, state: string, page: number, search: string): string {
  const params = new URLSearchParams({ type, state, page: String(page) });
  if (search) params.set('q', search);
  return `/admin/content?${params.toString()}`;
}

export default async function AdminContentPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;
  const type = first(params.type) === 'blog' ? 'blog' : 'event';
  const requestedState = first(params.state);
  const state = ['all', 'published', 'draft'].includes(requestedState) ? requestedState : 'all';
  const search = first(params.q).trim().slice(0, 80);
  const requestedPage = Number.parseInt(first(params.page), 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const from = (page - 1) * PAGE_SIZE;
  const supabase = await createServerSupabaseClient();
  let rows: ContentRow[] = [];
  let count = 0;
  let error = false;

  if (type === 'event') {
    let query = supabase.from('events')
      .select('id, slug, title_vi, starts_at, image_url, is_published', { count: 'exact' })
      .order('starts_at', { ascending: false });
    if (state !== 'all') query = query.eq('is_published', state === 'published');
    if (search) query = query.ilike('title_vi', `%${escapeLike(search)}%`);
    const result = await query.range(from, from + PAGE_SIZE - 1);
    error = Boolean(result.error);
    count = result.count ?? 0;
    rows = (result.data ?? []).map((row) => ({
      id: row.id, image: row.image_url, isPublished: row.is_published, label: 'Sự kiện',
      publicPath: `/events/${row.id}`, secondary: new Date(row.starts_at).toLocaleDateString('vi-VN'), title: row.title_vi,
    }));
  } else {
    let query = supabase.from('blog_posts')
      .select('id, slug, title_vi, published_at, cover_image_url, is_published', { count: 'exact' })
      .order('published_at', { ascending: false, nullsFirst: false });
    if (state !== 'all') query = query.eq('is_published', state === 'published');
    if (search) query = query.ilike('title_vi', `%${escapeLike(search)}%`);
    const result = await query.range(from, from + PAGE_SIZE - 1);
    error = Boolean(result.error);
    count = result.count ?? 0;
    rows = (result.data ?? []).map((row) => ({
      id: row.id, image: row.cover_image_url, isPublished: row.is_published, label: 'Bài viết',
      publicPath: `/blog/${row.slug}`, secondary: row.published_at ? new Date(row.published_at).toLocaleDateString('vi-VN') : 'Chưa công bố', title: row.title_vi,
    }));
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  return (
    <main className={`wrap ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <Link href="/admin" className={styles.backLink}><ArrowLeft size={16} /> Tổng quan</Link>
          <h1>Content Operations</h1>
          <p>Quản lý trạng thái công bố; nội dung và ảnh vẫn theo nguồn đã duyệt.</p>
        </div>
        <span className={styles.total}>{count} nội dung</span>
      </header>

      <nav className={styles.tabs} aria-label="Loại nội dung">
        <Link href={contentLink('event', state, 1, search)} className={type === 'event' ? styles.activeTab : ''}>Sự kiện</Link>
        <Link href={contentLink('blog', state, 1, search)} className={type === 'blog' ? styles.activeTab : ''}>Bài viết</Link>
      </nav>
      <form className={styles.searchForm} action="/admin/content" method="get">
        <input type="hidden" name="type" value={type} /><input type="hidden" name="state" value={state} />
        <label htmlFor="content-search">Tìm theo tiêu đề</label>
        <div><input id="content-search" name="q" defaultValue={search} maxLength={80} /><button><Search size={16} /> Tìm</button></div>
      </form>
      <div className={styles.filters} aria-label="Lọc trạng thái công bố">
        {['all', 'published', 'draft'].map((item) => (
          <Link key={item} href={contentLink(type, item, 1, search)} className={state === item ? styles.activeFilter : ''}>{item === 'all' ? 'Tất cả' : item}</Link>
        ))}
      </div>

      {error ? <div className={styles.stateBox} role="alert">Không thể tải nội dung.</div> : rows.length === 0 ? (
        <div className={styles.stateBox}>Không có nội dung phù hợp.</div>
      ) : (
        <div className={styles.requestList}>
          {rows.map((row) => (
            <article key={row.id} className={`${styles.requestRow} ${styles.contentRow}`}>
              <div className={styles.productIdentity}>
                <Image src={row.image} alt="" width={56} height={56} className={styles.productImage} />
                <span><strong>{row.title}</strong><small>{row.label} · {row.id}</small></span>
              </div>
              <div><span className={styles.label}>Lịch</span><strong>{row.secondary}</strong></div>
              <div><span className={styles.label}>Trang công khai</span><Link href={row.publicPath} target="_blank">Mở trang <ExternalLink size={13} /></Link></div>
              <div><span className={styles.label}>Công bố</span><ContentPublicationForm contentId={row.id} contentType={type} isPublished={row.isPublished} /></div>
            </article>
          ))}
        </div>
      )}
      {totalPages > 1 && <nav className={styles.pagination} aria-label="Phân trang nội dung">
        {page > 1 && <Link href={contentLink(type, state, page - 1, search)}>Trang trước</Link>}
        <span>Trang {Math.min(page, totalPages)} / {totalPages}</span>
        {page < totalPages && <Link href={contentLink(type, state, page + 1, search)}>Trang sau</Link>}
      </nav>}
    </main>
  );
}
