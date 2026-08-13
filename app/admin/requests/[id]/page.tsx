import Link from 'next/link';
import { ArrowLeft, ExternalLink, History, Inbox } from 'lucide-react';
import { notFound } from 'next/navigation';
import styles from '../requests.module.css';
import detailStyles from '../../../account/account.module.css';
import RequestStatusForm from '../RequestStatusForm';
import { requireAdmin } from '@/lib/auth/session';
import type { Database } from '@/lib/supabase/database.types';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type Booking = Pick<
  Database['public']['Tables']['booking_requests']['Row'],
  'id' | 'reference_number' | 'customer_name' | 'customer_phone' | 'reservation_at' |
  'guest_count' | 'seating_area' | 'note' | 'consent_to_contact' | 'status' | 'created_at'
>;
type CustomerRequest = Pick<
  Database['public']['Tables']['customer_requests']['Row'],
  'id' | 'reference_number' | 'request_type' | 'contact_name' | 'contact_phone' | 'contact_email' |
  'subject_reference' | 'organization' | 'volume_range' | 'message' | 'consent_to_contact' |
  'status' | 'created_at'
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

function reference(prefix: string, number: number): string {
  return `${prefix}-${String(number).padStart(6, '0')}`;
}

function requestTypeLabel(type: string): string {
  return type === 'contact' ? 'Liên hệ' : type === 'rsvp' ? 'Đăng ký sự kiện' : type === 'b2b' ? 'Báo giá B2B' : type;
}

function volumeLabel(volume: string | null): string {
  if (!volume) return 'Chưa cập nhật';
  return volume === 'over_100' ? 'Trên 100 kg/tháng' : `${volume.replace('_', '-')} kg/tháng`;
}

function value(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === '' ? 'Chưa cập nhật' : String(value);
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Chờ xử lý',
    confirmed: 'Đã xác nhận',
    completed: 'Hoàn tất',
    cancelled: 'Đã hủy',
    rejected: 'Từ chối',
    in_progress: 'Đang xử lý',
    resolved: 'Đã giải quyết',
  };
  return labels[status] ?? status;
}

function RequestHistory({ history, error }: { history: StatusHistory[]; error?: boolean }) {
  return (
    <section aria-labelledby="request-history-title">
      <header className={styles.sectionHeader}><h2 id="request-history-title"><History size={17} /> Lịch sử trạng thái</h2><span>{history.length} lần thay đổi</span></header>
      {error ? <div className={styles.stateBox} role="alert">Không thể tải lịch sử trạng thái.</div> : history.length === 0 ? <div className={styles.stateBox}>Chưa có lịch sử thay đổi.</div> : (
        <div className={styles.requestList}>
          {history.map((entry) => (
            <article key={entry.id} className={styles.requestRow}>
              <div><span className={styles.label}>Thời gian</span><strong>{formatDate(entry.created_at)}</strong></div>
              <div><span className={styles.label}>Chuyển trạng thái</span><strong>{statusLabel(entry.from_status)} → {statusLabel(entry.to_status)}</strong></div>
              <div><span className={styles.label}>Nguồn</span><strong>Admin</strong></div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function AdminRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string | string[] }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const kind = first((await searchParams).kind) === 'booking' ? 'booking' : 'customer';
  const supabase = await createServerSupabaseClient();

  if (kind === 'booking') {
    const result = await supabase
      .from('booking_requests')
      .select('id, reference_number, customer_name, customer_phone, reservation_at, guest_count, seating_area, note, consent_to_contact, status, created_at')
      .eq('id', id)
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
      <main className={`wrap ${styles.page}`}>
        <header className={styles.header}>
          <div><Link href="/admin/requests?view=bookings" className={styles.backLink}><ArrowLeft size={16} /> Danh sách đặt bàn</Link><span className={detailStyles.detailEyebrow}><Inbox size={16} /> Booking Operations</span><h1>{reference('BK', booking.reference_number)}</h1><p>Nhận lúc {formatDate(booking.created_at)}</p></div>
        </header>
        <section className={styles.detailWorkflow} aria-labelledby="booking-workflow-title">
          <div className={styles.detailWorkflowHeader}><div><h2 id="booking-workflow-title">Tiến trình đặt bàn</h2><p>Chuyển sang bước tiếp theo sau khi đã xử lý yêu cầu.</p></div></div>
          <RequestStatusForm kind="booking" requestId={booking.id} currentStatus={booking.status} variant="detail" />
        </section>
        <section className={detailStyles.orderDetailGrid} aria-label="Chi tiết yêu cầu đặt bàn">
          <div className={detailStyles.orderDetailPanel}><h2>Thông tin khách</h2><dl className={detailStyles.detailList}><div><dt>Họ tên</dt><dd>{booking.customer_name}</dd></div><div><dt>Số điện thoại</dt><dd>{booking.customer_phone}</dd></div><div><dt>Số khách</dt><dd>{booking.guest_count}</dd></div><div><dt>Khu vực</dt><dd>{booking.seating_area}</dd></div><div><dt>Đồng ý liên hệ</dt><dd>{booking.consent_to_contact ? 'Có' : 'Không'}</dd></div></dl></div>
          <div className={detailStyles.orderDetailPanel}><h2>Lịch đặt</h2><dl className={detailStyles.detailList}><div><dt>Thời gian</dt><dd>{formatDate(booking.reservation_at)}</dd></div><div><dt>Thông báo nội bộ</dt><dd><Link href="/admin/notifications" className={styles.detailLink}>Mở trung tâm thông báo</Link></dd></div><div><dt>Ghi chú</dt><dd>{value(booking.note)}</dd></div></dl></div>
        </section>
        <RequestHistory history={history} error={Boolean(historyResult.error)} />
      </main>
    );
  }

  const result = await supabase
    .from('customer_requests')
    .select('id, reference_number, request_type, contact_name, contact_phone, contact_email, subject_reference, organization, volume_range, message, consent_to_contact, status, created_at')
    .eq('id', id)
    .maybeSingle();
  if (result.error || !result.data) notFound();
  const request = result.data as CustomerRequest;
  const historyResult = await supabase
    .from('customer_request_status_history')
    .select('id, from_status, to_status, created_at')
    .eq('customer_request_id', id)
    .order('created_at', { ascending: false });
  const history = (historyResult.data ?? []) as StatusHistory[];
  const prefix = request.request_type === 'contact' ? 'CT' : request.request_type === 'rsvp' ? 'EV' : 'BQ';
  return (
    <main className={`wrap ${styles.page}`}>
      <header className={styles.header}>
        <div><Link href="/admin/requests?view=leads" className={styles.backLink}><ArrowLeft size={16} /> Danh sách customer requests</Link><span className={detailStyles.detailEyebrow}><Inbox size={16} /> Lead Operations</span><h1>{reference(prefix, request.reference_number)}</h1><p>Nhận lúc {formatDate(request.created_at)}</p></div>
      </header>
      <section className={styles.detailWorkflow} aria-labelledby="customer-workflow-title">
        <div className={styles.detailWorkflowHeader}><div><h2 id="customer-workflow-title">Tiến trình yêu cầu</h2><p>Chuyển sang bước tiếp theo sau khi đã xử lý yêu cầu.</p></div></div>
        <RequestStatusForm kind="customer" requestId={request.id} currentStatus={request.status} variant="detail" />
      </section>
      <section className={detailStyles.orderDetailGrid} aria-label="Chi tiết customer request">
        <div className={detailStyles.orderDetailPanel}><h2>Thông tin liên hệ</h2><dl className={detailStyles.detailList}><div><dt>Loại yêu cầu</dt><dd>{requestTypeLabel(request.request_type)}</dd></div><div><dt>Họ tên</dt><dd>{request.contact_name}</dd></div><div><dt>Số điện thoại</dt><dd>{request.contact_phone}</dd></div><div><dt>Email</dt><dd>{value(request.contact_email)}</dd></div><div><dt>Đồng ý liên hệ</dt><dd>{request.consent_to_contact ? 'Có' : 'Không'}</dd></div></dl></div>
        <div className={detailStyles.orderDetailPanel}><h2>Nội dung</h2><dl className={detailStyles.detailList}><div><dt>Sự kiện / sản phẩm</dt><dd>{value(request.subject_reference)}</dd></div><div><dt>Tổ chức</dt><dd>{value(request.organization)}</dd></div><div><dt>Sản lượng</dt><dd>{volumeLabel(request.volume_range)}</dd></div><div><dt>Thông báo nội bộ</dt><dd><Link href="/admin/notifications" className={styles.detailLink}>Mở trung tâm thông báo</Link></dd></div><div><dt>Nội dung</dt><dd>{value(request.message)}</dd></div></dl></div>
      </section>
      <RequestHistory history={history} error={Boolean(historyResult.error)} />
      <p><Link href="/admin/requests?view=leads" className={styles.detailLink}>Quay lại danh sách <ExternalLink size={14} /></Link></p>
    </main>
  );
}
