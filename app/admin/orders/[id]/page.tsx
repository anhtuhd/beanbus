import Link from 'next/link';
import { ArrowLeft, CircleAlert, ExternalLink, ShoppingBag } from 'lucide-react';
import { notFound } from 'next/navigation';
import styles from '../../requests/requests.module.css';
import detailStyles from '../../../account/account.module.css';
import OrderStatusForm from '../OrderStatusForm';
import RefundOrderForm from '../RefundOrderForm';
import { requireAdmin } from '@/lib/auth/session';
import type { Database } from '@/lib/supabase/database.types';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type Order = Database['public']['Tables']['orders']['Row'];
type OrderItem = Pick<
  Database['public']['Tables']['order_items']['Row'],
  'id' | 'product_name_vi' | 'product_name_en' | 'quantity' | 'unit_price_vnd' | 'line_total_vnd' | 'special_note'
>;
type ItemOption = Pick<
  Database['public']['Tables']['order_item_options']['Row'],
  'order_item_id' | 'option_name_vi' | 'extra_price_vnd'
>;
type StatusHistory = Pick<
  Database['public']['Tables']['order_status_history']['Row'],
  'id' | 'from_status' | 'to_status' | 'actor_type' | 'created_at'
>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang chuẩn bị',
  ready: 'Sẵn sàng',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
};
const PAYMENT_METHOD_LABEL: Record<string, string> = { cod: 'COD', sepay_qr: 'Sepay QR' };
const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thanh toán lỗi',
  expired: 'Hết hạn',
  refunded: 'Đã hoàn tiền',
};

function formatDate(value: string | null): string {
  if (!value) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
}

function formatMoney(value: number): string {
  return `${value.toLocaleString('vi-VN')}đ`;
}

function statusLabel(status: string | null): string {
  return status ? STATUS_LABEL[status] ?? status : 'Chưa cập nhật';
}

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createServerSupabaseClient();
  const orderResult = await supabase
    .from('orders')
    .select('id, order_number, customer_name, customer_phone, fulfillment, pickup_at, delivery_address, note, voucher_code, subtotal_vnd, discount_vnd, total_vnd, payment_method, payment_status, status, created_at')
    .eq('id', id)
    .maybeSingle();
  if (orderResult.error || !orderResult.data) notFound();
  const order = orderResult.data as Pick<Order, 'id' | 'order_number' | 'customer_name' | 'customer_phone' | 'fulfillment' | 'pickup_at' | 'delivery_address' | 'note' | 'voucher_code' | 'subtotal_vnd' | 'discount_vnd' | 'total_vnd' | 'payment_method' | 'payment_status' | 'status' | 'created_at'>;

  const [itemsResult, historyResult] = await Promise.all([
    supabase.from('order_items').select('id, product_name_vi, product_name_en, quantity, unit_price_vnd, line_total_vnd, special_note').eq('order_id', id),
    supabase.from('order_status_history').select('id, from_status, to_status, actor_type, created_at').eq('order_id', id).order('created_at', { ascending: false }),
  ]);
  const items = (itemsResult.data ?? []) as OrderItem[];
  const itemIds = items.map((item) => item.id);
  const optionsResult = itemIds.length
    ? await supabase.from('order_item_options').select('order_item_id, option_name_vi, extra_price_vnd').in('order_item_id', itemIds)
    : { data: [], error: null };
  const options = (optionsResult.data ?? []) as ItemOption[];
  const history = (historyResult.data ?? []) as StatusHistory[];
  const dataError = Boolean(itemsResult.error || optionsResult.error || historyResult.error);

  return (
    <main className={`wrap ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <Link href="/admin/orders" className={styles.backLink}><ArrowLeft size={16} /> Danh sách đơn hàng</Link>
          <span className={detailStyles.detailEyebrow}><ShoppingBag size={16} /> Order Operations</span>
          <h1>Đơn #{order.order_number}</h1>
          <p>Tạo lúc {formatDate(order.created_at)}</p>
        </div>
        <div>
          <OrderStatusForm orderId={order.id} currentStatus={order.status} paymentMethod={order.payment_method} paymentStatus={order.payment_status} />
          {order.payment_method === 'sepay_qr' && order.payment_status === 'paid' && <RefundOrderForm orderId={order.id} amountVnd={order.total_vnd} />}
        </div>
      </header>

      {dataError && <div className={styles.stateBox} role="alert">Một phần chi tiết đơn hàng chưa thể tải.</div>}

      <section className={detailStyles.orderDetailGrid} aria-label="Chi tiết đơn hàng">
        <div className={detailStyles.orderDetailPanel}>
          <h2>Món đã đặt</h2>
          {items.length === 0 ? <div className={styles.stateBox}>Không có dòng sản phẩm.</div> : (
            <div className={detailStyles.detailList}>
              {items.map((item) => (
                <div key={item.id}>
                  <dt>{item.product_name_vi} x{item.quantity}</dt>
                  <dd>{formatMoney(item.line_total_vnd)}<small>{item.unit_price_vnd.toLocaleString('vi-VN')}đ / món{item.special_note ? ` · ${item.special_note}` : ''}{options.filter((option) => option.order_item_id === item.id).map((option) => ` · ${option.option_name_vi}`).join('')}</small></dd>
                </div>
              ))}
            </div>
          )}
          <div className={detailStyles.detailTotals}>
            <div><span>Tạm tính</span><strong>{formatMoney(order.subtotal_vnd)}</strong></div>
            <div><span>Giảm giá</span><strong>-{formatMoney(order.discount_vnd)}</strong></div>
            <div className={detailStyles.detailGrandTotal}><span>Tổng thanh toán</span><strong>{formatMoney(order.total_vnd)}</strong></div>
          </div>
        </div>

        <div className={detailStyles.orderDetailPanel}>
          <h2>Thông tin khách hàng</h2>
          <dl className={detailStyles.detailList}>
            <div><dt>Khách hàng</dt><dd>{order.customer_name}</dd></div>
            <div><dt>Số điện thoại</dt><dd>{order.customer_phone}</dd></div>
            <div><dt>Nhận hàng</dt><dd>{order.fulfillment === 'pickup' ? 'Nhận tại quán' : 'Giao hàng'}</dd></div>
            {order.pickup_at && <div><dt>Thời gian nhận</dt><dd>{formatDate(order.pickup_at)}</dd></div>}
            {order.delivery_address && <div><dt>Địa chỉ</dt><dd>{order.delivery_address}</dd></div>}
            <div><dt>Thanh toán</dt><dd>{PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method} · {PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status}</dd></div>
            {order.voucher_code && <div><dt>Voucher</dt><dd>{order.voucher_code}</dd></div>}
            {order.note && <div><dt>Ghi chú</dt><dd>{order.note}</dd></div>}
          </dl>
        </div>
      </section>

      <section aria-labelledby="order-history-title">
        <header className={styles.sectionHeader}><h2 id="order-history-title">Lịch sử trạng thái</h2><span>{history.length} lần thay đổi</span></header>
        {history.length === 0 ? <div className={styles.stateBox}>Chưa có lịch sử thay đổi.</div> : (
          <div className={styles.requestList}>
            {history.map((entry) => (
              <article key={entry.id} className={styles.requestRow}>
                <div><span className={styles.label}>Thời gian</span><strong>{formatDate(entry.created_at)}</strong></div>
                <div><span className={styles.label}>Chuyển trạng thái</span><strong>{statusLabel(entry.from_status)} → {statusLabel(entry.to_status)}</strong></div>
                <div><span className={styles.label}>Nguồn</span><strong>{entry.actor_type === 'admin' ? 'Admin' : 'System'}</strong></div>
                <div><Link href="/admin/orders" className={styles.detailLink}>Danh sách đơn <ExternalLink size={14} /></Link></div>
              </article>
            ))}
          </div>
        )}
      </section>

      {order.status === 'cancelled' && <p className={styles.stateBox} role="status"><CircleAlert size={16} /> Đơn hàng này đã bị hủy.</p>}
    </main>
  );
}
