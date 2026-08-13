import Link from 'next/link';
import { ArrowLeft, Search, Ticket } from 'lucide-react';
import type { Database } from '@/lib/supabase/database.types';
import { requireAdmin } from '@/lib/auth/session';
import { boundedPage } from '@/lib/pagination';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import VoucherEditorForm from './VoucherEditorForm';
import styles from '../requests/requests.module.css';
import { LocalizedText } from '@/components/ui/LocalizedText';

type Voucher = Pick<Database['public']['Tables']['vouchers']['Row'], 'code' | 'discount_type' | 'discount_value' | 'minimum_subtotal_vnd' | 'maximum_discount_vnd' | 'starts_at' | 'ends_at' | 'usage_limit' | 'is_active' | 'usage_count'>;
type PageProps = { searchParams: Promise<{ page?: string | string[]; q?: string | string[] }> };
const PAGE_SIZE = 20;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function pageLink(page: number, search: string): string {
  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set('q', search);
  return `/admin/vouchers?${params.toString()}`;
}

function formatDate(value: string | null): string {
  return value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value)) : 'Không giới hạn';
}

export default async function AdminVouchersPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;
  const search = first(params.q).trim().slice(0, 40).toUpperCase();
  const requestedPage = Number.parseInt(first(params.page), 10);
  const page = boundedPage(requestedPage);
  const supabase = await createServerSupabaseClient();
  let query = supabase.from('vouchers').select('code, discount_type, discount_value, minimum_subtotal_vnd, maximum_discount_vnd, starts_at, ends_at, usage_limit, is_active, usage_count', { count: 'exact' }).order('created_at', { ascending: false });
  if (search) query = query.ilike('code', `%${search.replace(/[\\%_]/g, '\\$&')}%`);
  const result = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const vouchers: Voucher[] = result.data ?? [];
  const totalPages = Math.max(1, Math.ceil((result.count ?? 0) / PAGE_SIZE));

  return (
    <main className={`wrap ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <Link href="/admin" className={styles.backLink}><ArrowLeft size={16} /> Tổng quan</Link>
          <h1><Ticket size={24} /> Voucher Operations</h1>
          <p>Quản lý voucher dùng trong checkout; mọi thay đổi được ghi audit.</p>
        </div>
        <span className={styles.total}>{result.count ?? 0} voucher</span>
      </header>
      <details className={styles.editorDetails}>
        <summary>Thêm voucher</summary>
        <VoucherEditorForm />
      </details>
      <form className={styles.searchForm} action="/admin/vouchers" method="get">
        <label htmlFor="voucher-search">Tìm theo mã voucher</label>
        <div>
          <input id="voucher-search" name="q" defaultValue={search} maxLength={40} />
          <button type="submit"><Search size={16} /> <LocalizedText vi="Tìm" en="Search" /></button>
          {search && <Link href={pageLink(1, '')}>Xóa lọc</Link>}
        </div>
      </form>
      {result.error ? <div className={styles.stateBox} role="alert">Không thể tải voucher.</div> : vouchers.length === 0 ? <div className={styles.stateBox}>Chưa có voucher.</div> : (
        <div className={styles.requestList}>
          {vouchers.map((voucher) => (
            <article key={voucher.code} className={`${styles.requestRow} ${styles.contentRow}`}>
              <div><span className={styles.label}>Mã</span><strong>{voucher.code}</strong><small>{voucher.discount_type === 'percent' ? `Giảm ${voucher.discount_value}%` : `Giảm ${voucher.discount_value.toLocaleString('vi-VN')}đ`}</small></div>
              <div><span className={styles.label}>Điều kiện</span><strong>Từ {voucher.minimum_subtotal_vnd.toLocaleString('vi-VN')}đ</strong><small>{voucher.maximum_discount_vnd ? `Tối đa ${voucher.maximum_discount_vnd.toLocaleString('vi-VN')}đ` : 'Không giới hạn mức giảm'}</small></div>
              <div><span className={styles.label}>Thời hạn</span><strong>{formatDate(voucher.starts_at)} → {formatDate(voucher.ends_at)}</strong><small>Dùng {voucher.usage_count}{voucher.usage_limit ? ` / ${voucher.usage_limit}` : ''}</small></div>
              <div><span className={styles.label}>Trạng thái</span><strong>{voucher.is_active ? 'Đang hoạt động' : 'Tạm tắt'}</strong></div>
              <details className={styles.inlineEditor}>
                <summary>Chỉnh sửa voucher</summary>
                <VoucherEditorForm voucher={voucher} />
              </details>
            </article>
          ))}
        </div>
      )}
      {totalPages > 1 && <nav className={styles.pagination} aria-label="Phân trang voucher">
        {page > 1 && <Link href={pageLink(page - 1, search)}>Trang trước</Link>}
        <span>Trang {Math.min(page, totalPages)} / {totalPages}</span>
        {page < totalPages && <Link href={pageLink(page + 1, search)}>Trang sau</Link>}
      </nav>}
    </main>
  );
}
