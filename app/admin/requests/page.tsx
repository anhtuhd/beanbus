import Link from 'next/link';
import { ArrowLeft, CalendarDays, Inbox, Search } from 'lucide-react';
import RequestStatusForm from './RequestStatusForm';
import styles from './requests.module.css';
import { normalizeVietnameseMobile } from '@/lib/auth/input';
import { requireAdmin } from '@/lib/auth/session';
import { boundedPage } from '@/lib/pagination';
import type { Database } from '@/lib/supabase/database.types';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type BookingRow = Pick<
  Database['public']['Tables']['booking_requests']['Row'],
  'id' | 'reference_number' | 'customer_name' | 'customer_phone' | 'reservation_at' |
  'guest_count' | 'seating_area' | 'note' | 'status' | 'notification_status' | 'created_at'
>;
type CustomerRow = Pick<
  Database['public']['Tables']['customer_requests']['Row'],
  'id' | 'reference_number' | 'request_type' | 'contact_name' | 'contact_phone' |
  'contact_email' | 'subject_reference' | 'organization' | 'volume_range' | 'message' |
  'status' | 'notification_status' | 'created_at'
>;

type PageProps = {
  searchParams: Promise<{
    page?: string | string[];
    q?: string | string[];
    status?: string | string[];
    notification?: string | string[];
    view?: string | string[];
  }>;
};
type RequestView = 'bookings' | 'leads' | 'all';

const PAGE_SIZE = 20;
const BOOKING_STATUSES = ['all', 'pending', 'confirmed', 'completed', 'cancelled', 'rejected'];
const CUSTOMER_STATUSES = ['all', 'pending', 'in_progress', 'resolved', 'rejected', 'cancelled'];
const ALL_STATUSES = Array.from(new Set([...BOOKING_STATUSES, ...CUSTOMER_STATUSES]));

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function pageLink(view: RequestView, status: string, page: number, search = '', notification = ''): string {
  const params = new URLSearchParams({ view, status, page: String(page) });
  if (search) params.set('q', search);
  if (notification) params.set('notification', notification);
  return `/admin/requests?${params.toString()}`;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}

function reference(prefix: string, number: number): string {
  return `${prefix}-${String(number).padStart(6, '0')}`;
}

function detailForRequest(request: CustomerRow): string {
  if (request.request_type === 'contact') return request.message ?? 'Không có nội dung';
  if (request.request_type === 'rsvp') return `Sự kiện: ${request.subject_reference ?? 'Không xác định'}`;
  const volume = request.volume_range === 'over_100' ? '>100 kg/tháng' : `${request.volume_range?.replace('_', '-')} kg/tháng`;
  return [request.organization, request.subject_reference && `Hạt: ${request.subject_reference}`, volume].filter(Boolean).join(' · ');
}

function notificationLabel(status: BookingRow['notification_status']): string {
  return status === 'sent' ? 'Đã gửi' : status === 'pending' ? 'Đang chờ gửi' : status === 'failed' ? 'Gửi lỗi' : 'Chưa cấu hình';
}

function BookingList({ bookings }: { bookings: BookingRow[] }) {
  if (bookings.length === 0) return <div className={styles.stateBox}>Chưa có yêu cầu đặt bàn phù hợp.</div>;
  return <div className={styles.requestList}>{bookings.map((booking) => (
    <article key={booking.id} className={styles.requestRow}>
      <div><span className={styles.label}>Mã</span><Link href={`/admin/requests/${booking.id}?kind=booking`} className={styles.detailLink}><strong>{reference('BK', booking.reference_number)}</strong></Link></div>
      <div><span className={styles.label}>Khách hàng</span><strong>{booking.customer_name}</strong><small>{booking.customer_phone}</small></div>
      <div><span className={styles.label}>Lịch đặt</span><strong>{formatDate(booking.reservation_at)}</strong><small>{booking.guest_count} khách · {booking.seating_area}</small></div>
      <div><span className={styles.label}>Ghi chú</span><span>{booking.note || 'Không có'}</span></div>
      <div><span className={styles.label}>Trạng thái</span><RequestStatusForm kind="booking" requestId={booking.id} currentStatus={booking.status} /><small>Thông báo: {notificationLabel(booking.notification_status)}</small></div>
    </article>
  ))}</div>;
}

function CustomerList({ requests }: { requests: CustomerRow[] }) {
  if (requests.length === 0) return <div className={styles.stateBox}>Chưa có yêu cầu khách hàng phù hợp.</div>;
  return <div className={styles.requestList}>{requests.map((request) => (
    <article key={request.id} className={styles.requestRow}>
      <div><span className={styles.label}>Mã / Loại</span><Link href={`/admin/requests/${request.id}?kind=customer`} className={styles.detailLink}><strong>{reference(request.request_type === 'contact' ? 'CT' : request.request_type === 'rsvp' ? 'EV' : 'BQ', request.reference_number)}</strong></Link><small>{request.request_type}</small></div>
      <div><span className={styles.label}>Liên hệ</span><strong>{request.contact_name}</strong><small>{request.contact_phone}{request.contact_email ? ` · ${request.contact_email}` : ''}</small></div>
      <div><span className={styles.label}>Nội dung</span><span>{detailForRequest(request)}</span></div>
      <div><span className={styles.label}>Ngày nhận</span><span>{formatDate(request.created_at)}</span></div>
      <div><span className={styles.label}>Trạng thái</span><RequestStatusForm kind="customer" requestId={request.id} currentStatus={request.status} /><small>Thông báo: {notificationLabel(request.notification_status)}</small></div>
    </article>
  ))}</div>;
}

export default async function AdminRequestsPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;
  const requestedView = first(params.view);
  const view: RequestView = requestedView === 'leads' || requestedView === 'all' ? requestedView : 'bookings';
  const supportedStatuses = view === 'bookings' ? BOOKING_STATUSES : view === 'leads' ? CUSTOMER_STATUSES : ALL_STATUSES;
  const requestedStatus = first(params.status);
  const status = supportedStatuses.includes(requestedStatus) ? requestedStatus : 'all';
  const notification = first(params.notification) === 'failed' ? 'failed' : 'all';
  const search = first(params.q).trim().slice(0, 50);
  const requestedPage = Number.parseInt(first(params.page), 10);
  const page = boundedPage(requestedPage);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const queryFrom = view === 'all' ? 0 : from;
  const supabase = await createServerSupabaseClient();

  let bookings: BookingRow[] = [];
  let requests: CustomerRow[] = [];
  let count = 0;
  let failed = false;

  if (view !== 'leads') {
    let query = supabase
      .from('booking_requests')
      .select('id, reference_number, customer_name, customer_phone, reservation_at, guest_count, seating_area, note, status, notification_status, created_at', { count: 'exact' })
      .order('created_at', { ascending: false });
    if (status !== 'all') query = query.eq('status', status as BookingRow['status']);
    if (notification === 'failed') query = query.eq('notification_status', 'failed');
    if (search) {
      const phone = normalizeVietnameseMobile(search);
      if (/^\d{1,9}$/.test(search)) query = query.eq('reference_number', Number(search));
      else if (phone) query = query.eq('customer_phone', phone);
      else query = query.ilike('customer_name', `%${escapeLike(search)}%`);
    }
    const result = await query.range(queryFrom, to);
    bookings = result.data ?? [];
    count += result.count ?? 0;
    failed = failed || Boolean(result.error);
  }
  if (view !== 'bookings') {
    let query = supabase
      .from('customer_requests')
      .select('id, reference_number, request_type, contact_name, contact_phone, contact_email, subject_reference, organization, volume_range, message, status, notification_status, created_at', { count: 'exact' })
      .order('created_at', { ascending: false });
    if (status !== 'all') query = query.eq('status', status as CustomerRow['status']);
    if (notification === 'failed') query = query.eq('notification_status', 'failed');
    if (search) {
      const phone = normalizeVietnameseMobile(search);
      if (/^\d{1,9}$/.test(search)) query = query.eq('reference_number', Number(search));
      else if (phone) query = query.eq('contact_phone', phone);
      else query = query.ilike('contact_name', `%${escapeLike(search)}%`);
    }
    const result = await query.range(queryFrom, to);
    requests = result.data ?? [];
    count += result.count ?? 0;
    failed = failed || Boolean(result.error);
  }

  if (view === 'all') {
    const combined: Array<
      | { kind: 'booking'; row: BookingRow; createdAt: string }
      | { kind: 'customer'; row: CustomerRow; createdAt: string }
    > = [
      ...bookings.map((row) => ({ kind: 'booking' as const, row, createdAt: row.created_at })),
      ...requests.map((row) => ({ kind: 'customer' as const, row, createdAt: row.created_at })),
    ].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    const visible = combined.slice(from, to + 1);
    bookings = visible.filter((item): item is { kind: 'booking'; row: BookingRow; createdAt: string } => item.kind === 'booking').map((item) => item.row);
    requests = visible.filter((item): item is { kind: 'customer'; row: CustomerRow; createdAt: string } => item.kind === 'customer').map((item) => item.row);
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const statuses = view === 'bookings' ? BOOKING_STATUSES : view === 'leads' ? CUSTOMER_STATUSES : ALL_STATUSES;

  return (
    <main className={`wrap ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <Link href="/admin" className={styles.backLink}><ArrowLeft size={16} /> Tổng quan</Link>
          <h1>Booking & Customer Requests</h1>
          <p>Dữ liệu production, chỉ dành cho tài khoản admin.</p>
        </div>
        <span className={styles.total}>{count} yêu cầu</span>
      </header>

      <nav className={styles.tabs} aria-label="Loại yêu cầu">
        <Link href={pageLink('all', 'all', 1, '', notification)} className={view === 'all' ? styles.activeTab : ''}>
          <Inbox size={17} /> Tất cả
        </Link>
        <Link href={pageLink('bookings', 'all', 1, '', notification)} className={view === 'bookings' ? styles.activeTab : ''}>
          <CalendarDays size={17} /> Đặt bàn
        </Link>
        <Link href={pageLink('leads', 'all', 1, '', notification)} className={view === 'leads' ? styles.activeTab : ''}>
          <Inbox size={17} /> Liên hệ, RSVP & B2B
        </Link>
      </nav>

      <form className={styles.searchForm} action="/admin/requests" method="get">
        <input type="hidden" name="view" value={view} />
        <input type="hidden" name="status" value={status} />
        {notification === 'failed' && <input type="hidden" name="notification" value="failed" />}
        <label htmlFor="request-search">Tìm theo mã yêu cầu, số điện thoại hoặc tên khách</label>
        <div>
          <input id="request-search" name="q" defaultValue={search} maxLength={50} />
          <button type="submit"><Search size={16} /> Tìm</button>
          {search && <Link href={pageLink(view, status, 1, '', notification)}>Xóa lọc</Link>}
        </div>
      </form>

      <div className={styles.filters} aria-label="Lọc trạng thái">
        {statuses.map((item) => (
            <Link key={item} href={pageLink(view, item, 1, search, notification === 'failed' ? 'failed' : '')} className={status === item ? styles.activeFilter : ''}>
            {item === 'all' ? 'Tất cả' : item.replace('_', ' ')}
          </Link>
        ))}
      </div>
      <div className={styles.filters} aria-label="Lọc trạng thái thông báo">
        <Link href={pageLink(view, status, 1, search)} className={notification === 'all' ? styles.activeFilter : ''}>Tất cả thông báo</Link>
        <Link href={pageLink(view, status, 1, search, 'failed')} className={notification === 'failed' ? styles.activeFilter : ''}>Thông báo lỗi</Link>
      </div>

      {failed ? (
        <div className={styles.stateBox} role="alert">Không thể tải dữ liệu yêu cầu. Vui lòng thử lại.</div>
      ) : view === 'all' ? (
        <div>
          <section aria-labelledby="booking-results-title"><header className={styles.sectionHeader}><h2 id="booking-results-title">Đặt bàn</h2><span>{bookings.length} kết quả</span></header><BookingList bookings={bookings} /></section>
          <section aria-labelledby="lead-results-title"><header className={styles.sectionHeader}><h2 id="lead-results-title">Liên hệ, RSVP & B2B</h2><span>{requests.length} kết quả</span></header><CustomerList requests={requests} /></section>
        </div>
      ) : view === 'bookings' ? <BookingList bookings={bookings} /> : <CustomerList requests={requests} />}

      {totalPages > 1 && (
        <nav className={styles.pagination} aria-label="Phân trang">
          {page > 1 && <Link href={pageLink(view, status, page - 1, search, notification === 'failed' ? 'failed' : '')}>Trang trước</Link>}
          <span>Trang {Math.min(page, totalPages)} / {totalPages}</span>
          {page < totalPages && <Link href={pageLink(view, status, page + 1, search, notification === 'failed' ? 'failed' : '')}>Trang sau</Link>}
        </nav>
      )}
    </main>
  );
}
