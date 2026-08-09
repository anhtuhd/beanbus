import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Search } from 'lucide-react';
import ProductStatusForm from './ProductStatusForm';
import styles from '../requests/requests.module.css';
import { requireAdmin } from '@/lib/auth/session';
import type { Database } from '@/lib/supabase/database.types';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type ProductRow = Pick<
  Database['public']['Tables']['products']['Row'],
  'id' | 'category_id' | 'name_vi' | 'name_en' | 'price_vnd' | 'image_url' |
  'is_available' | 'is_published' | 'sort_order' | 'updated_at'
>;

type PageProps = {
  searchParams: Promise<{
    category?: string | string[];
    page?: string | string[];
    q?: string | string[];
    state?: string | string[];
  }>;
};

const PAGE_SIZE = 20;
const PRODUCT_STATES = ['all', 'published', 'draft', 'available', 'unavailable'];

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function catalogLink(state: string, category: string, page: number, search: string): string {
  const params = new URLSearchParams({ state, category, page: String(page) });
  if (search) params.set('q', search);
  return `/admin/catalog?${params.toString()}`;
}

export default async function AdminCatalogPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const categoriesResult = await supabase
    .from('catalog_categories')
    .select('id, name_vi')
    .order('sort_order');
  const categories = categoriesResult.data ?? [];
  const categoryIds = new Set(categories.map((item) => item.id));
  const requestedCategory = first(params.category);
  const category = categoryIds.has(requestedCategory) ? requestedCategory : 'all';
  const requestedState = first(params.state);
  const state = PRODUCT_STATES.includes(requestedState) ? requestedState : 'all';
  const search = first(params.q).trim().slice(0, 80);
  const requestedPage = Number.parseInt(first(params.page), 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('products')
    .select('id, category_id, name_vi, name_en, price_vnd, image_url, is_available, is_published, sort_order, updated_at', { count: 'exact' })
    .order('sort_order');
  if (category !== 'all') query = query.eq('category_id', category);
  if (state === 'published') query = query.eq('is_published', true);
  if (state === 'draft') query = query.eq('is_published', false);
  if (state === 'available') query = query.eq('is_available', true);
  if (state === 'unavailable') query = query.eq('is_available', false);
  if (search) query = query.ilike('name_vi', `%${escapeLike(search)}%`);
  const result = await query.range(from, from + PAGE_SIZE - 1);
  const products: ProductRow[] = result.data ?? [];
  const count = result.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const categoryNames = new Map(categories.map((item) => [item.id, item.name_vi]));

  return (
    <main className={`wrap ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <Link href="/admin" className={styles.backLink}><ArrowLeft size={16} /> Tổng quan</Link>
          <h1>Catalog Operations</h1>
          <p>Giá và nội dung lấy từ catalog production; thay đổi trạng thái được ghi audit.</p>
        </div>
        <span className={styles.total}>{count} sản phẩm</span>
      </header>

      <form className={styles.searchForm} action="/admin/catalog" method="get">
        <input type="hidden" name="state" value={state} />
        <input type="hidden" name="category" value={category} />
        <label htmlFor="catalog-search">Tìm theo tên sản phẩm</label>
        <div>
          <input id="catalog-search" name="q" defaultValue={search} maxLength={80} />
          <button type="submit"><Search size={16} /> Tìm</button>
          {search && <Link href={catalogLink(state, category, 1, '')}>Xóa lọc</Link>}
        </div>
      </form>

      <div className={styles.filterGroups}>
        <div className={styles.filters} aria-label="Lọc hiển thị sản phẩm">
          {PRODUCT_STATES.map((item) => (
            <Link key={item} href={catalogLink(item, category, 1, search)} className={state === item ? styles.activeFilter : ''}>
              {item === 'all' ? 'Tất cả trạng thái' : item}
            </Link>
          ))}
        </div>
        <div className={styles.filters} aria-label="Lọc danh mục">
          <Link href={catalogLink(state, 'all', 1, search)} className={category === 'all' ? styles.activeFilter : ''}>Tất cả danh mục</Link>
          {categories.map((item) => (
            <Link key={item.id} href={catalogLink(state, item.id, 1, search)} className={category === item.id ? styles.activeFilter : ''}>{item.name_vi}</Link>
          ))}
        </div>
      </div>

      {result.error || categoriesResult.error ? (
        <div className={styles.stateBox} role="alert">Không thể tải catalog.</div>
      ) : products.length === 0 ? (
        <div className={styles.stateBox}>Không có sản phẩm phù hợp.</div>
      ) : (
        <div className={styles.requestList}>
          {products.map((product) => (
            <article key={product.id} className={`${styles.requestRow} ${styles.catalogRow}`}>
              <div className={styles.productIdentity}>
                <Image src={product.image_url} alt="" width={56} height={56} className={styles.productImage} />
                <span><strong>{product.name_vi}</strong><small>{product.name_en}</small></span>
              </div>
              <div><span className={styles.label}>Mã / Danh mục</span><strong>{product.id}</strong><small>{categoryNames.get(product.category_id) ?? product.category_id}</small></div>
              <div><span className={styles.label}>Giá canonical</span><strong>{product.price_vnd.toLocaleString('vi-VN')}đ</strong></div>
              <div><span className={styles.label}>Trạng thái</span><ProductStatusForm productId={product.id} isAvailable={product.is_available} isPublished={product.is_published} /></div>
            </article>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className={styles.pagination} aria-label="Phân trang catalog">
          {page > 1 && <Link href={catalogLink(state, category, page - 1, search)}>Trang trước</Link>}
          <span>Trang {Math.min(page, totalPages)} / {totalPages}</span>
          {page < totalPages && <Link href={catalogLink(state, category, page + 1, search)}>Trang sau</Link>}
        </nav>
      )}
    </main>
  );
}
