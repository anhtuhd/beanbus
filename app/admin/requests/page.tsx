import Link from 'next/link';
import { ArrowLeft, Bell, CalendarDays, Inbox, Search } from 'lucide-react';
import RequestStatusForm from './RequestStatusForm';
import styles from './requests.module.css';
import { normalizeVietnameseMobile } from '@/lib/auth/input';
import { requireAdmin } from '@/lib/auth/session';
import { boundedPage } from '@/lib/pagination';
import type { Database } from '@/lib/supabase/database.types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { LocalizedText } from '@/components/ui/LocalizedText';
import { REQUEST_STATUS_LABELS, type RequestStatus } from './request-workflow';

type RequestRow = Database['public']['Views']['admin_request_feed']['Row'];

type PageProps = {
  searchParams: Promise<{
    page?: string | string[];
    q?: string | string[];
    status?: string | string[];
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

function pageLink(view: RequestView, status: string, page: number, search = ''): string {
  const params = new URLSearchParams({ view, status, page: String(page) });
  if (search) params.set('q', search);
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

function detailForRequest(request: RequestRow): string {
  if (request.request_type === 'contact') return request.message ?? 'Không có nội dung';
  if (request.request_type === 'rsvp') return `Sự kiện: ${request.subject_reference ?? 'Không xác định'}`;
  const volume = request.volume_range === 'over_100' ? '>100 kg/tháng' : `${request.volume_range?.replace('_', '-')} kg/tháng`;
  return [request.organization, request.subject_reference && `Hạt: ${request.subject_reference}`, volume].filter(Boolean).join(' · ');
}

function statusFilterLabel(status: string, view: RequestView): { vi: string; en: string } {
  if (status === 'all') return { vi: 'Tất cả', en: 'All' };
  if (status === 'pending' && view === 'bookings') return { vi: 'Chờ xác nhận', en: 'Awaiting confirmation' };
  return REQUEST_STATUS_LABELS[status as RequestStatus] ?? { vi: status.replace('_', ' '), en: status.replace('_', ' ') };
}

function BookingList({ bookings }: { bookings: RequestRow[] }) {
  if (bookings.length === 0) return <div className={styles.stateBox}>Chưa có yêu cầu đặt bàn phù hợp.</div>;
  return <div className={styles.requestList}>{bookings.map((booking) => (
    <article key={booking.id} className={styles.requestRow}>
      <div><span className={styles.label}><LocalizedText vi="Mã" en="Reference" /></span><Link href={`/admin/requests/${booking.id}?kind=booking`} className={styles.detailLink}><strong>{reference('BK', booking.reference_number)}</strong></Link></div>
      <div><span className={styles.label}><LocalizedText vi="Khách hàng" en="Customer" /></span><strong>{booking.display_name}</strong><small>{booking.display_phone}</small></div>
      <div><span className={styles.label}><LocalizedText vi="Lịch đặt" en="Booking time" /></span><strong>{booking.reservation_at ? formatDate(booking.reservation_at) : 'Chưa xác định'}</strong><small>{booking.guest_count} khách · {booking.seating_area}</small></div>
      <div><span className={styles.label}><LocalizedText vi="Ghi chú" en="Note" /></span><span>{booking.note || 'Không có'}</span></div>
      <div className={styles.requestWorkflowCell}><span className={styles.label}><LocalizedText vi="Tiến trình đặt bàn" en="Booking progress" /></span><RequestStatusForm kind="booking" requestId={booking.id} currentStatus={booking.status} variant="compact" /></div>
    </article>
  ))}</div>;
}

function CustomerList({ requests }: { requests: RequestRow[] }) {
  if (requests.length === 0) return <div className={styles.stateBox}>Chưa có yêu cầu khách hàng phù hợp.</div>;
  return <div className={styles.requestList}>{requests.map((request) => (
    <article key={request.id} className={styles.requestRow}>
      <div><span className={styles.label}><LocalizedText vi="Mã / Loại" en="Reference / Type" /></span><Link href={`/admin/requests/${request.id}?kind=customer`} className={styles.detailLink}><strong>{reference(request.request_type === 'contact' ? 'CT' : request.request_type === 'rsvp' ? 'EV' : 'BQ', request.reference_number)}</strong></Link><small>{request.request_type}</small></div>
      <div><span className={styles.label}><LocalizedText vi="Liên hệ" en="Contact" /></span><strong>{request.display_name}</strong><small>{request.display_phone}{request.contact_email ? ` · ${request.contact_email}` : ''}</small></div>
      <div><span className={styles.label}><LocalizedText vi="Nội dung" en="Details" /></span><span>{detailForRequest(request)}</span></div>
      <div><span className={styles.label}><LocalizedText vi="Ngày nhận" en="Received" /></span><span>{formatDate(request.created_at)}</span></div>
      <div className={styles.requestWorkflowCell}><span className={styles.label}><LocalizedText vi="Tiến trình yêu cầu" en="Request progress" /></span><RequestStatusForm kind="customer" requestId={request.id} currentStatus={request.status} variant="compact" /></div>
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
  const search = first(params.q).trim().slice(0, 50);
  const requestedPage = Number.parseInt(first(params.page), 10);
  const page = boundedPage(requestedPage);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from('admin_request_feed')
    .select('kind, id, reference_number, request_type, display_name, display_phone, contact_email, reservation_at, guest_count, seating_area, note, subject_reference, organization, volume_range, message, status, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (view !== 'all') query = query.eq('kind', view === 'bookings' ? 'booking' : 'customer');
  if (status !== 'all') query = query.eq('status', status);
  if (search) {
    const phone = normalizeVietnameseMobile(search);
    if (/^\d{1,9}$/.test(search)) query = query.eq('reference_number', Number(search));
    else if (phone) query = query.eq('display_phone', phone);
    else query = query.ilike('display_name', `%${escapeLike(search)}%`);
  }
  const result = await query.range(from, to);
  const rows = result.data ?? [];
  const bookings = rows.filter((row) => row.kind === 'booking');
  const requests = rows.filter((row) => row.kind === 'customer');
  const count = result.count ?? 0;
  const failed = Boolean(result.error);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const statuses = view === 'bookings' ? BOOKING_STATUSES : view === 'leads' ? CUSTOMER_STATUSES : ALL_STATUSES;

  return (
    <main className={`wrap ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <Link href="/admin" className={styles.backLink}><ArrowLeft size={16} /> <LocalizedText vi="Tổng quan" en="Overview" /></Link>
          <h1><LocalizedText vi="Đặt bàn & yêu cầu khách hàng" en="Booking & customer requests" /></h1>
          <p><LocalizedText vi="Dữ liệu production, chỉ dành cho tài khoản admin." en="Production data, available to admins only." /></p>
        </div>
        <div className={styles.requestHeaderActions}>
          <Link href="/admin/notifications" className={styles.detailLink}><Bell size={16} /> <LocalizedText vi="Trung tâm thông báo" en="Notification center" /></Link>
          <span className={styles.resultCount}><strong>{count}</strong> <LocalizedText vi="kết quả" en="results" /></span>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="Loại yêu cầu">
        <Link href={pageLink('all', 'all', 1)} className={view === 'all' ? styles.activeTab : ''}>
          <Inbox size={17} /> Tất cả
        </Link>
        <Link href={pageLink('bookings', 'all', 1)} className={view === 'bookings' ? styles.activeTab : ''}>
          <CalendarDays size={17} /> <LocalizedText vi="Đặt bàn" en="Bookings" />
        </Link>
        <Link href={pageLink('leads', 'all', 1)} className={view === 'leads' ? styles.activeTab : ''}>
          <Inbox size={17} /> <LocalizedText vi="Liên hệ, RSVP & B2B" en="Contact, RSVP & B2B" />
        </Link>
      </nav>

      <form className={styles.searchForm} action="/admin/requests" method="get">
        <input type="hidden" name="view" value={view} />
        <input type="hidden" name="status" value={status} />
        <label htmlFor="request-search"><LocalizedText vi="Tìm theo mã yêu cầu, số điện thoại hoặc tên khách" en="Search by reference, phone or customer name" /></label>
        <div>
          <input id="request-search" name="q" defaultValue={search} maxLength={50} />
          <button type="submit"><Search size={16} /> <LocalizedText vi="Tìm" en="Search" /></button>
          {search && <Link href={pageLink(view, status, 1)}><LocalizedText vi="Xóa lọc" en="Clear" /></Link>}
        </div>
      </form>

      <div className={styles.filters} aria-label="Lọc trạng thái">
        {statuses.map((item) => (
            <Link key={item} href={pageLink(view, item, 1, search)} className={status === item ? styles.activeFilter : ''}>
            <LocalizedText {...statusFilterLabel(item, view)} />
          </Link>
        ))}
      </div>
      {failed ? (
        <div className={styles.stateBox} role="alert">Không thể tải dữ liệu yêu cầu. Vui lòng thử lại.</div>
      ) : view === 'all' ? (
        <div>
          <section aria-labelledby="booking-results-title"><header className={styles.sectionHeader}><h2 id="booking-results-title"><LocalizedText vi="Đặt bàn" en="Bookings" /></h2><span>{bookings.length} <LocalizedText vi="kết quả" en="results" /></span></header><BookingList bookings={bookings} /></section>
          <section aria-labelledby="lead-results-title"><header className={styles.sectionHeader}><h2 id="lead-results-title"><LocalizedText vi="Liên hệ, RSVP & B2B" en="Contact, RSVP & B2B" /></h2><span>{requests.length} <LocalizedText vi="kết quả" en="results" /></span></header><CustomerList requests={requests} /></section>
        </div>
      ) : view === 'bookings' ? <BookingList bookings={bookings} /> : <CustomerList requests={requests} />}

      {totalPages > 1 && (
        <nav className={styles.pagination} aria-label="Phân trang">
          {page > 1 && <Link href={pageLink(view, status, page - 1, search)}>Trang trước</Link>}
          <span>Trang {Math.min(page, totalPages)} / {totalPages}</span>
          {page < totalPages && <Link href={pageLink(view, status, page + 1, search)}>Trang sau</Link>}
        </nav>
      )}
    </main>
  );
}
