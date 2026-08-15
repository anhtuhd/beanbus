import Link from 'next/link';
import { ArrowLeft, Plus, Search } from 'lucide-react';
import OrderStatusForm from './OrderStatusForm';
import styles from '../requests/requests.module.css';
import { normalizeVietnameseMobile } from '@/lib/auth/input';
import { requireAdmin } from '@/lib/auth/session';
import { boundedPage } from '@/lib/pagination';
import type { Database } from '@/lib/supabase/database.types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { LocalizedText } from '@/components/ui/LocalizedText';

type OrderRow = Pick<
  Database['public']['Tables']['orders']['Row'],
  'id' | 'order_code' | 'order_number' | 'customer_name' | 'customer_phone' | 'fulfillment' | 'pickup_at' |
  'delivery_address' | 'total_vnd' | 'points_applied' | 'cash_due_vnd' | 'payment_method' | 'payment_status' | 'status' | 'created_at'
>;

type PageProps = {
  searchParams: Promise<{
    page?: string | string[];
    q?: string | string[];
    status?: string | string[];
  }>;
};

const PAGE_SIZE = 20;
const ORDER_STATUSES = ['all', 'pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
const STATUS_LABEL: Record<string, string> = {
  all: 'Tất cả',
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang chuẩn bị',
  ready: 'Sẵn sàng',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
};
const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cod: 'COD',
  sepay_qr: 'Sepay QR',
};
const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thanh toán lỗi',
  expired: 'Hết hạn',
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function orderLink(status: string, page: number, search: string): string {
  const params = new URLSearchParams({ status, page: String(page) });
  if (search) params.set('q', search);
  return `/admin/orders?${params.toString()}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}

function formatMoney(value: number): string {
  return `${value.toLocaleString('vi-VN')}đ`;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;
  const requestedStatus = first(params.status);
  const status = ORDER_STATUSES.includes(requestedStatus) ? requestedStatus : 'all';
  const search = first(params.q).trim().slice(0, 50);
  const requestedPage = Number.parseInt(first(params.page), 10);
  const page = boundedPage(requestedPage);
  const from = (page - 1) * PAGE_SIZE;
  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from('orders')
    .select('id, order_code, order_number, customer_name, customer_phone, fulfillment, pickup_at, delivery_address, total_vnd, points_applied, cash_due_vnd, payment_method, payment_status, status, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (status !== 'all') query = query.eq('status', status as OrderRow['status']);
  if (search) {
    const phone = normalizeVietnameseMobile(search);
    if (/^DH-[0-9]{6}[A-Za-z0-9]{6}$/i.test(search)) query = query.eq('order_code', search.toUpperCase());
    else if (/^\d{1,9}$/.test(search)) query = query.eq('order_number', Number(search));
    else if (phone) query = query.eq('customer_phone', phone);
    else query = query.ilike('customer_name', `%${escapeLike(search)}%`);
  }
  const result = await query.range(from, from + PAGE_SIZE - 1);
  const orders: OrderRow[] = result.data ?? [];
  const count = result.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <main className={`wrap ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <Link href="/admin" className={styles.backLink}><ArrowLeft size={16} /> Tổng quan</Link>
          <h1>Order Operations</h1>
          <p>Trạng thái thanh toán chỉ được thay đổi bởi luồng thanh toán đã xác minh.</p>
        </div>
        <div className={styles.headerActions}>
          {process.env.ENABLE_ADMIN_ASSISTED_ORDERS === 'true' && <Link href="/admin/orders/new" className={styles.primaryLink}><Plus size={16} /> Tạo đơn</Link>}
          <span className={styles.total}>{count} đơn</span>
        </div>
      </header>

      <form className={styles.searchForm} action="/admin/orders" method="get">
        <input type="hidden" name="status" value={status} />
        <label htmlFor="order-search">Tìm theo mã đơn, số điện thoại hoặc tên khách</label>
        <div>
          <input id="order-search" name="q" defaultValue={search} maxLength={50} />
          <button type="submit"><Search size={16} /> <LocalizedText vi="Tìm" en="Search" /></button>
          {search && <Link href={orderLink(status, 1, '')}>Xóa lọc</Link>}
        </div>
      </form>

      <div className={styles.filters} aria-label="Lọc trạng thái đơn">
        {ORDER_STATUSES.map((item) => (
          <Link key={item} href={orderLink(item, 1, search)} className={status === item ? styles.activeFilter : ''}>
            {STATUS_LABEL[item] ?? item}
          </Link>
        ))}
      </div>

      {result.error ? (
        <div className={styles.stateBox} role="alert">Không thể tải danh sách đơn hàng.</div>
      ) : orders.length === 0 ? (
        <div className={styles.stateBox}>Không có đơn hàng phù hợp.</div>
      ) : (
        <div className={styles.requestList}>
          {orders.map((order) => (
            <article key={order.id} className={`${styles.requestRow} ${styles.orderRow}`}>
              <div><span className={styles.label}>Mã / Thời gian</span><Link href={`/admin/orders/${order.id}`} className={styles.detailLink}><strong>{order.order_code}</strong></Link><small>{formatDate(order.created_at)}</small></div>
              <div><span className={styles.label}>Khách hàng</span><strong>{order.customer_name}</strong><small>{order.customer_phone}</small></div>
              <div><span className={styles.label}>Nhận hàng</span><strong>{order.fulfillment === 'pickup' ? 'Nhận tại quán' : 'Giao hàng'}</strong><small>{order.pickup_at ? formatDate(order.pickup_at) : order.delivery_address}</small></div>
              <div><span className={styles.label}>Thanh toán</span><strong>{formatMoney(order.cash_due_vnd)}</strong><small>Tổng {formatMoney(order.total_vnd)}{order.points_applied > 0 ? ` · Điểm ${order.points_applied.toLocaleString('vi-VN')}` : ''} · {PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method} · {PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status}</small></div>
              <div className={styles.orderWorkflowCell}><span className={styles.label}><LocalizedText vi="Tiến trình xử lý" en="Order progress" /></span><OrderStatusForm orderId={order.id} currentStatus={order.status} paymentMethod={order.payment_method} paymentStatus={order.payment_status} /></div>
            </article>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className={styles.pagination} aria-label="Phân trang đơn hàng">
          {page > 1 && <Link href={orderLink(status, page - 1, search)}>Trang trước</Link>}
          <span>Trang {Math.min(page, totalPages)} / {totalPages}</span>
          {page < totalPages && <Link href={orderLink(status, page + 1, search)}>Trang sau</Link>}
        </nav>
      )}
    </main>
  );
}
