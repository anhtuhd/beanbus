import Link from 'next/link';
import { ArrowLeft, Gift, Search } from 'lucide-react';
import type { Database } from '@/lib/supabase/database.types';
import { requireAdmin } from '@/lib/auth/session';
import { boundedPage } from '@/lib/pagination';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import RewardEditorForm from './RewardEditorForm';
import styles from '../requests/requests.module.css';
import { LocalizedText } from '@/components/ui/LocalizedText';

type Reward = Pick<Database['public']['Tables']['loyalty_rewards']['Row'], 'id' | 'name_vi' | 'name_en' | 'points_cost' | 'discount_type' | 'discount_value' | 'minimum_subtotal_vnd' | 'maximum_discount_vnd' | 'is_active'>;
type PageProps = { searchParams: Promise<{ page?: string | string[]; q?: string | string[] }> };
const PAGE_SIZE = 20;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function pageLink(page: number, search: string): string {
  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set('q', search);
  return `/admin/rewards?${params.toString()}`;
}

export default async function AdminRewardsPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;
  const search = first(params.q).trim().replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 80);
  const requestedPage = Number.parseInt(first(params.page), 10);
  const page = boundedPage(requestedPage);
  const supabase = await createServerSupabaseClient();
  let query = supabase.from('loyalty_rewards').select('id, name_vi, name_en, points_cost, discount_type, discount_value, minimum_subtotal_vnd, maximum_discount_vnd, is_active', { count: 'exact' }).order('points_cost');
  if (search) {
    const escaped = search.replace(/[\\%_]/g, '\\$&');
    query = query.or(`id.ilike.%${escaped}%,name_vi.ilike.%${escaped}%,name_en.ilike.%${escaped}%`);
  }
  const result = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const rewards: Reward[] = result.data ?? [];
  const totalPages = Math.max(1, Math.ceil((result.count ?? 0) / PAGE_SIZE));
  return <main className={`wrap ${styles.page}`}>
    <header className={styles.header}><div><Link href="/admin" className={styles.backLink}><ArrowLeft size={16} /> Tổng quan</Link><h1><Gift size={24} /> Reward Catalog</h1><p>Phần thưởng đổi điểm; chỉ reward active mới hiển thị cho hội viên.</p></div><span className={styles.total}>{result.count ?? 0} reward</span></header>
    <details className={styles.editorDetails}><summary>Thêm reward</summary><RewardEditorForm /></details>
    <form className={styles.searchForm} action="/admin/rewards" method="get">
      <label htmlFor="reward-search">Tìm theo mã hoặc tên reward</label>
      <div>
        <input id="reward-search" name="q" defaultValue={search} maxLength={80} />
        <button type="submit"><Search size={16} /> <LocalizedText vi="Tìm" en="Search" /></button>
        {search && <Link href={pageLink(1, '')}>Xóa lọc</Link>}
      </div>
    </form>
    {result.error ? <div className={styles.stateBox} role="alert">Không thể tải reward catalog.</div> : rewards.length === 0 ? <div className={styles.stateBox}>Chưa có reward phù hợp.</div> : <div className={styles.requestList}>{rewards.map((reward) => <article key={reward.id} className={`${styles.requestRow} ${styles.contentRow}`}><div><span className={styles.label}>Reward</span><strong>{reward.id}</strong><small>{reward.name_vi}</small></div><div><span className={styles.label}>Chi phí</span><strong>{reward.points_cost.toLocaleString('vi-VN')} điểm</strong></div><div><span className={styles.label}>Voucher</span><strong>{reward.discount_type === 'percent' ? `Giảm ${reward.discount_value}%` : `Giảm ${reward.discount_value.toLocaleString('vi-VN')}đ`}</strong><small>Từ {reward.minimum_subtotal_vnd.toLocaleString('vi-VN')}đ</small></div><div><span className={styles.label}>Trạng thái</span><strong>{reward.is_active ? 'Đang hiển thị' : 'Tạm ẩn'}</strong></div><details className={styles.inlineEditor}><summary>Chỉnh sửa reward</summary><RewardEditorForm reward={reward} /></details></article>)}</div>}
    {totalPages > 1 && <nav className={styles.pagination} aria-label="Phân trang reward"><>{page > 1 && <Link href={pageLink(page - 1, search)}>Trang trước</Link>}<span>Trang {Math.min(page, totalPages)} / {totalPages}</span>{page < totalPages && <Link href={pageLink(page + 1, search)}>Trang sau</Link>}</></nav>}
  </main>;
}
