import Link from 'next/link';
import { ArrowLeft, History, Inbox } from 'lucide-react';
import { notFound } from 'next/navigation';
import styles from '../../account.module.css';
import { requireProfile } from '@/lib/auth/session';
import type { Database } from '@/lib/supabase/database.types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import CancelBookingForm from '../CancelBookingForm';

type Booking = Pick<
  Database['public']['Tables']['booking_requests']['Row'],
  'id' | 'reference_number' | 'customer_name' | 'customer_phone' | 'reservation_at' | 'guest_count' |
  'seating_area' | 'note' | 'status' | 'notification_status' | 'created_at'
>;
type CustomerRequest = Pick<
  Database['public']['Tables']['customer_requests']['Row'],
  'id' | 'reference_number' | 'request_type' | 'contact_name' | 'contact_phone' | 'contact_email' |
  'subject_reference' | 'organization' | 'volume_range' | 'message' | 'status' | 'notification_status' | 'created_at'
>;
type StatusHistory = {
  id: number;
  from_status: string;
  to_status: string;
  created_at: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
}

function notificationLabel(status: string): string {
  return status === 'sent' ? 'Đã gửi' : status === 'pending' ? 'Đang chờ gửi' : status === 'failed' ? 'Gửi lỗi' : 'Chưa cấu hình';
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = { pending: 'Chờ xử lý', confirmed: 'Đã xác nhận', completed: 'Hoàn tất', cancelled: 'Đã hủy', rejected: 'Từ chối', in_progress: 'Đang xử lý', resolved: 'Đã giải quyết' };
  return labels[status] ?? status;
}

function display(value: string | number | null): string {
  return value === null || value === '' ? 'Chưa cập nhật' : String(value);
}

function StatusHistoryList({ history, error }: { history: StatusHistory[]; error?: boolean }) {
  return (
    <section className={styles.orderDetailPanel} aria-labelledby="request-history-title">
      <h2 id="request-history-title"><History size={17} /> Lịch sử trạng thái</h2>
      {error ? <p className={styles.accountStatus} role="alert">Chưa thể tải lịch sử trạng thái.</p> : history.length === 0 ? <p className={styles.emptyState}>Chưa có lần cập nhật trạng thái.</p> : (
        <div className={styles.loyaltyEntryList}>
          {history.map((entry) => (
            <div key={entry.id} className={styles.loyaltyEntry}>
              <div><strong>{statusLabel(entry.from_status)} → {statusLabel(entry.to_status)}</strong><small>Beanbus Operations</small></div>
              <time dateTime={entry.created_at}>{formatDate(entry.created_at)}</time>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function MemberRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string | string[] }>;
}) {
  const profile = await requireProfile('/account');
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const kind = first((await searchParams).kind) === 'booking' ? 'booking' : 'customer';
  const supabase = await createServerSupabaseClient();

  if (kind === 'booking') {
    const result = await supabase
      .from('booking_requests')
      .select('id, reference_number, customer_name, customer_phone, reservation_at, guest_count, seating_area, note, status, notification_status, created_at')
      .eq('id', id)
      .eq('user_id', profile.id)
      .maybeSingle();
    if (result.error || !result.data) notFound();
    const booking = result.data as Booking;
    const historyResult = await supabase
      .from('booking_request_status_history')
      .select('id, from_status, to_status, created_at')
      .eq('booking_request_id', id)
      .order('created_at', { ascending: false });
    const history = (historyResult.data ?? []) as StatusHistory[];
    return (
      <main className={`wrap ${styles.accountPage}`}>
        <Link href="/account" className={styles.accountBackLink}><ArrowLeft size={16} aria-hidden="true" /> Quay lại tài khoản</Link>
        <header className={styles.orderDetailHeader}><div><span className={styles.detailEyebrow}><Inbox size={16} /> Yêu cầu của tôi</span><h1>Đặt bàn #{booking.reference_number}</h1><p>Gửi lúc {formatDate(booking.created_at)}</p></div><span className={`${styles.statusBadge} ${styles[`status_${booking.status}`]}`}>{statusLabel(booking.status)}</span></header>
        <CancelBookingForm requestId={booking.id} currentStatus={booking.status} />
        <section className={styles.orderDetailGrid}><div className={styles.orderDetailPanel}><h2>Lịch đặt</h2><dl className={styles.detailList}><div><dt>Thời gian</dt><dd>{formatDate(booking.reservation_at)}</dd></div><div><dt>Số khách</dt><dd>{booking.guest_count}</dd></div><div><dt>Khu vực</dt><dd>{booking.seating_area}</dd></div><div><dt>Thông báo</dt><dd>{notificationLabel(booking.notification_status)}</dd></div><div><dt>Ghi chú</dt><dd>{display(booking.note)}</dd></div></dl></div><div className={styles.orderDetailPanel}><h2>Thông tin liên hệ</h2><dl className={styles.detailList}><div><dt>Họ tên</dt><dd>{booking.customer_name}</dd></div><div><dt>Số điện thoại</dt><dd>{booking.customer_phone}</dd></div></dl></div></section>
        <StatusHistoryList history={history} error={Boolean(historyResult.error)} />
      </main>
    );
  }

  const result = await supabase
    .from('customer_requests')
    .select('id, reference_number, request_type, contact_name, contact_phone, contact_email, subject_reference, organization, volume_range, message, status, notification_status, created_at')
    .eq('id', id)
    .eq('user_id', profile.id)
    .maybeSingle();
  if (result.error || !result.data) notFound();
  const request = result.data as CustomerRequest;
  const historyResult = await supabase
    .from('customer_request_status_history')
    .select('id, from_status, to_status, created_at')
    .eq('customer_request_id', id)
    .order('created_at', { ascending: false });
  const history = (historyResult.data ?? []) as StatusHistory[];
  return (
    <main className={`wrap ${styles.accountPage}`}>
      <Link href="/account" className={styles.accountBackLink}><ArrowLeft size={16} aria-hidden="true" /> Quay lại tài khoản</Link>
      <header className={styles.orderDetailHeader}><div><span className={styles.detailEyebrow}><Inbox size={16} /> Yêu cầu của tôi</span><h1>{request.request_type.toUpperCase()} #{request.reference_number}</h1><p>Gửi lúc {formatDate(request.created_at)}</p></div><span className={`${styles.statusBadge} ${styles[`status_${request.status}`]}`}>{statusLabel(request.status)}</span></header>
      <CancelBookingForm requestId={request.id} currentStatus={request.status} kind="customer" />
      <section className={styles.orderDetailGrid}><div className={styles.orderDetailPanel}><h2>Nội dung</h2><dl className={styles.detailList}><div><dt>Sự kiện / sản phẩm</dt><dd>{display(request.subject_reference)}</dd></div><div><dt>Tổ chức</dt><dd>{display(request.organization)}</dd></div><div><dt>Sản lượng</dt><dd>{display(request.volume_range)}</dd></div><div><dt>Message</dt><dd>{display(request.message)}</dd></div><div><dt>Thông báo</dt><dd>{notificationLabel(request.notification_status)}</dd></div></dl></div><div className={styles.orderDetailPanel}><h2>Thông tin liên hệ</h2><dl className={styles.detailList}><div><dt>Họ tên</dt><dd>{request.contact_name}</dd></div><div><dt>Số điện thoại</dt><dd>{request.contact_phone}</dd></div><div><dt>Email</dt><dd>{display(request.contact_email)}</dd></div></dl></div></section>
      <StatusHistoryList history={history} error={Boolean(historyResult.error)} />
    </main>
  );
}
